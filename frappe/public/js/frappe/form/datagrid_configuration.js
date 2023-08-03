export default class DatagridConfiguration {
  constructor(opts) {
    $.extend(this, opts);
    this.setup_configuration();
  }

  setup_configuration() {
    if (this.grid.df.in_place_edit && !this.frm) {
      this.wrapper.find(".grid-configuration").html("");
      return;
    }
    if (this.frm) {
      const $configuration_button = $(`<button class="grid-configure-columns btn btn-xs btn-secondary">
        ${frappe.utils.icon("setting-gear", "sm", "")}
      </button>`)
      this.wrapper.find(".grid-configuration").html($configuration_button);

      $configuration_button.on("click", () => {
        this.configure_dialog_for_columns_selector()
      })
    }
  }

  configure_dialog_for_columns_selector() {
    this.grid_settings_dialog = new frappe.ui.Dialog({
      title: __("Configure Columns"),
      fields: [
        {
          fieldtype: "HTML",
          fieldname: "fields_html",
        },
      ],
    });
    
    this.grid.setup_visible_columns();
    this.setup_columns_for_dialog();
    this.prepare_wrapper_for_columns();
    this.render_selected_columns();
    this.grid_settings_dialog.show();

    $(this.fields_html_wrapper)
      .find(".add-new-fields")
      .click(() => {
        this.column_selector_for_dialog();
      });

    this.grid_settings_dialog.set_primary_action(__("Update"), () => {
      this.validate_columns_width();
      this.columns = {};
      this.update_user_settings_for_grid();
      this.grid_settings_dialog.hide();
    });

    this.grid_settings_dialog.set_secondary_action_label(__("Reset to default"));
    this.grid_settings_dialog.set_secondary_action(() => {
      this.reset_user_settings_for_grid();
      this.grid_settings_dialog.hide();
    });
    
  }

  setup_columns_for_dialog() {
    this.selected_columns_for_grid = [];
    this.grid.visible_columns.forEach((row) => {
      this.selected_columns_for_grid.push({
        fieldname: row[0].fieldname,
        columns: row[0].columns || row[0].colsize,
      });
    });
  }
  
  prepare_wrapper_for_columns() {
    this.fields_html_wrapper = this.grid_settings_dialog.get_field("fields_html").$wrapper[0];

    $(`
      <div class='form-group'>
        <div class='row' style='margin:0px; margin-bottom:10px'>
          <div class='col-md-8'>
            ${__("Fieldname").bold()}
          </div>
          <div class='col-md-4' style='padding-left:5px;'>
            ${__("Column Width").bold()}
          </div>
        </div>
        <div class='control-input-wrapper selected-fields'>
        </div>
        <p class='help-box small text-muted'>
          <a class='add-new-fields text-muted'>
            + ${__("Add / Remove Columns")}
          </a>
        </p>
      </div>
    `).appendTo(this.fields_html_wrapper);
  }

  column_selector_for_dialog() {
    let docfields = this.prepare_columns_for_dialog(
      this.selected_columns_for_grid.map((field) => field.fieldname)
    );

    let d = new frappe.ui.Dialog({
      title: __("{0} Fields", [__(this.grid.doctype)]),
      fields: [
        {
          label: __("Select Fields"),
          fieldtype: "MultiCheck",
          fieldname: "fields",
          options: docfields,
          columns: 2,
        },
      ],
    });

    d.set_primary_action(__("Add"), () => {
      let selected_fields = d.get_values().fields;
      this.selected_columns_for_grid = [];
      if (selected_fields) {
        selected_fields.forEach((selected_column) => {
          let docfield = frappe.meta.get_docfield(this.grid.doctype, selected_column);
          this.grid.update_default_colsize(docfield);

          this.selected_columns_for_grid.push({
            fieldname: selected_column,
            columns: docfield.columns || docfield.colsize,
          });
        });

        this.render_selected_columns();
        d.hide();
      }
    });

    d.show();
  }

  prepare_columns_for_dialog(selected_fields) {
    let fields = [];

    const blocked_fields = frappe.model.no_value_type;
    const always_allow = ["Button"];

    const show_field = (f) => always_allow.includes(f) || !blocked_fields.includes(f);

    this.docfields.forEach((column) => {
      if (!column.hidden && show_field(column.fieldtype)) {
        fields.push({
          label: column.label,
          value: column.fieldname,
          checked: selected_fields ? in_list(selected_fields, column.fieldname) : false,
        });
      }
    });

    return fields;
  }
  
  render_selected_columns() {
    let fields = "";
    if (this.selected_columns_for_grid) {
      this.selected_columns_for_grid.forEach((d) => {
        let docfield = frappe.meta.get_docfield(this.grid.doctype, d.fieldname);

        fields += `
          <div class='control-input flex align-center form-control fields_order sortable-handle sortable'
            style='display: block; margin-bottom: 5px; cursor: pointer;' data-fieldname='${docfield.fieldname}'
            data-label='${docfield.label}' data-type='${docfield.fieldtype}'>

            <div class='row'>
              <div class='col-md-1' style='padding-top: 2px'>
                <a style='cursor: grabbing;'>${frappe.utils.icon("drag", "xs")}</a>
              </div>
              <div class='col-md-7' style='padding-left:0px; padding-top:3px'>
                ${__(docfield.label)}
              </div>
              <div class='col-md-3' style='padding-left:0px;margin-top:-2px;' title='${__("Columns")}'>
                <input class='form-control column-width input-xs text-right'
                  value='${docfield.columns || cint(d.columns)}'
                  data-fieldname='${docfield.fieldname}' style='background-color: var(--modal-bg); display: inline'>
              </div>
              <div class='col-md-1' style='padding-top: 3px'>
                <a class='text-muted remove-field' data-fieldname='${docfield.fieldname}'>
                  <i class='fa fa-trash-o' aria-hidden='true'></i>
                </a>
              </div>
            </div>
          </div>`;
      });
    }

    $(this.fields_html_wrapper).find(".selected-fields").html(fields);

    this.prepare_handler_for_sort();
    this.select_on_focus();
    this.update_column_width();
    this.remove_selected_column();
  }
  
  prepare_handler_for_sort() {
    new Sortable($(this.fields_html_wrapper).find(".selected-fields")[0], {
      handle: ".sortable-handle",
      draggable: ".sortable",
      onUpdate: () => {
        this.sort_columns();
      },
    });
  }
  
  sort_columns() {
    this.selected_columns_for_grid = [];

    let columns = $(this.fields_html_wrapper).find(".fields_order") || [];
    columns.each((idx) => {
      this.selected_columns_for_grid.push({
        fieldname: $(columns[idx]).attr("data-fieldname"),
        columns: cint($(columns[idx]).find(".column-width").attr("value")),
      });
    });
  }

  select_on_focus() {
    $(this.fields_html_wrapper)
      .find(".column-width")
      .click((event) => {
        $(event.target).select();
      });
  }
  
  update_column_width() {
    $(this.fields_html_wrapper)
      .find(".column-width")
      .change((event) => {
        if (cint(event.target.value) === 0) {
          event.target.value = cint(event.target.defaultValue);
          frappe.throw(__("Column width cannot be zero."));
        }

        this.selected_columns_for_grid.forEach((row) => {
          if (row.fieldname === event.target.dataset.fieldname) {
            row.columns = cint(event.target.value);
            event.target.defaultValue = cint(event.target.value);
          }
        });
      });
  }
  
  validate_columns_width() { // not needed
    let total_column_width = 0;

    this.selected_columns_for_grid.forEach((row) => {
      if (row.columns && row.columns > 0) {
        total_column_width += cint(row.columns);
      }
    });

  }

  remove_selected_column() {
    $(this.fields_html_wrapper)
      .find(".remove-field")
      .click((event) => {
        let fieldname = event.currentTarget.dataset.fieldname;
        let selected_columns_for_grid = this.selected_columns_for_grid.filter((row) => {
          return row.fieldname !== fieldname;
        });

        this.selected_columns_for_grid = selected_columns_for_grid;
        $(this.fields_html_wrapper).find(`[data-fieldname="${fieldname}"]`).remove();
      });
  }
  
  update_user_settings_for_grid() {
    if (!this.selected_columns_for_grid || !this.frm) {
      return;
    }

    let value = {};
    value[this.grid.doctype] = this.selected_columns_for_grid;
    frappe.model.user_settings.save(this.frm.doctype, "GridView", value).then((r) => {
      frappe.model.user_settings[this.frm.doctype] = r.message || r;
      this.grid.reset_grid();
    });
  }

  reset_user_settings_for_grid() {
    frappe.model.user_settings.save(this.frm.doctype, "GridView", null).then((r) => {
      frappe.model.user_settings[this.frm.doctype] = r.message || r;
      this.grid.reset_grid();
    });
  }

}