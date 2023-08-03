
import DataTable from "frappe-datatable";
import DatagridRow from "./datagrid_row";
import DatagridPagination from "./datagrid_pagination";
import DatagridConfiguration from "./datagrid_configuration";

export default class Datagrid {
  constructor(opts) {
    $.extend(this, opts)
    this.fieldinfo = {};
    this.doctype = this.df.options;
    
    if (this.doctype) {
			this.meta = frappe.get_meta(this.doctype);
		}
		this.fields_map = {};
    this.template = null;
		this.multiple_set = false;
		if (
			this.frm &&
			this.frm.meta.__form_grid_templates &&
			this.frm.meta.__form_grid_templates[this.df.fieldname]
		) {
			this.template = this.frm.meta.__form_grid_templates[this.df.fieldname];
		}
    this.filter = {};
		this.is_grid = true;
		this.debounced_refresh = this.refresh.bind(this);
    this.debounced_refresh = frappe.utils.debounce(this.debounced_refresh, 100);
    
    // Datatable
    this.datatable
    this.datatable_columns = []
    this.datatable_data = []
  }

  get perm() {
		return this.control?.perm || this.frm?.perm || this.df.perm;
	}

	set perm(_perm) {
		console.error("Setting perm on datagrid isn't supported, update form's perm instead");
  }

  // TODO: Check non editable datatale
  // allow_on_grid_editing() {}

  make() {
		let template = `
			<div class="grid-field">
				<label class="control-label">${__(this.df.label || "")}</label>
				<span class="help"></span>
				<p class="text-muted small grid-description"></p>
				<div class="grid-custom-buttons"></div>
				<div class="form-grid-container">
          <div class="form-grid">
          </div>
				</div>
				<div class="small form-clickable-section grid-footer">
					<div class="flex justify-between">
						<div class="grid-buttons">
              <button class="btn btn-xs btn-danger grid-remove-rows hidden"
								data-action="delete_rows">
								${__("Delete")}
							</button>
              <button class="btn btn-xs btn-danger grid-remove-all-rows hidden"
								data-action="delete_all_rows">
								${__("Delete All")}
							</button>
              <button class="grid-add-multiple-rows btn btn-xs btn-secondary hidden">
								${__("Add Multiple")}</a>
							</button>
							<!-- hack to allow firefox include this in tabs -->
							<button class="btn btn-xs btn-secondary grid-add-row">
								${__("Add Row")}
							</button>
						</div>
            <div class="grid-pagination">
						</div>
            <div class="grid-bulk-actions text-right">
							<button class="grid-download btn btn-xs btn-secondary hidden">
								${__("Download")}
							</button>
							<button class="grid-upload btn btn-xs btn-secondary hidden">
								${__("Upload")}
							</button>
						</div>
            <div class="grid-configuration">
						</div>
					</div>
				</div>
			</div>
		`;
    
    // TODO: Check add multiple
    // TODO: Check bulk actions

    this.wrapper = $(template).appendTo(this.parent);
    $(this.parent).addClass("form-group");
    this.set_grid_description();
    this.set_doc_url();
    
    frappe.utils.bind_actions_with_object(this.wrapper, this);

    this.form_grid = this.wrapper.find(".form-grid");

    this.setup_add_row();

    this.setup_grid_pagination();

		this.setup_grid_configuration();
    
    this.custom_buttons = {};
    this.grid_buttons = this.wrapper.find(".grid-buttons");
    this.grid_custom_buttons = this.wrapper.find(".grid-custom-buttons");
    this.remove_rows_button = this.grid_buttons.find(".grid-remove-rows");
    this.remove_all_rows_button = this.grid_buttons.find(".grid-remove-all-rows");
    this.configure_columns_button = this.grid_buttons.find(".grid-configure-columns");
    
    this.datatable = new DataTable(
			this.form_grid[0],
			{
				columns: [],
				data: [],
        inlineFilters: true,
        serialNoColumn: false,
				language: frappe.boot.lang,
				translations: frappe.utils.datatable.get_translations(),
				treeView: false,
				layout: "ratio",
        cellHeight: 32,
        checkboxColumn: true,
        checkedRowStatus: false,
				showTotalRow: false,
				direction: frappe.utils.is_rtl() ? "rtl" : "ltr",
        getEditor: this.get_editing_object.bind(this),
        noDataMessage: `
          <img
            src="/assets/frappe/images/ui-states/grid-empty-state.svg"
            alt="Grid Empty State"
            class="grid-empty-illustration"
            style="margin-bottom: var(--margin-sm)"
          >
          ${__("No Data")}
        `,
        events: {
          onCheckRow: this.setup_check.bind(this),
        }
			}
    );
    
    // NOTE: Move styles to function or styles file
    // Reqd style
    this.datatable.style.setStyle(`.dt-row-header .dt-cell__content span`, { color: "var(--red-400)" });
    
    // TODO: Check bulk edit
    // this.setup_allow_bulk_edit();

    if (this.df.on_setup) {
			this.df.on_setup(this);
		}
  }

  set_grid_description() {
		let description_wrapper = $(this.parent).find(".grid-description");
		if (this.df.description) {
			description_wrapper.text(__(this.df.description));
		} else {
			description_wrapper.hide();
		}
	}

	set_doc_url() {
		let unsupported_fieldtypes = frappe.model.no_value_type.filter(
			(x) => frappe.model.table_fields.indexOf(x) === -1
    );

		if (
			!this.df.label ||
			!this.df?.documentation_url ||
			in_list(unsupported_fieldtypes, this.df.fieldtype)
		)
			return;

		let $help = $(this.wrapper).find("span.help");
		$help.empty();
		$(`<a href="${this.df.documentation_url}" target="_blank">
			${frappe.utils.icon("help", "sm")}
		</a>`).appendTo($help);
  }

  setup_grid_pagination() {
		this.grid_pagination = new DatagridPagination({
			grid: this,
			wrapper: this.wrapper,
		});
  }

  // NOTE: Probably datagrid configuration
  setup_grid_configuration() {
    this.grid_configuration = new DatagridConfiguration({
      wrapper: this.wrapper,
      parent_df: this.df,
      docfields: this.docfields,
      frm: this.frm,
      grid: this,
    })
  }

  setup_check() {
    const indexes = this.datatable.rowmanager.getCheckedRows();
    const checked_docs = indexes.map((i) => {
      // NOTE: Check if there is a faster way of doing this
      // Using first col to get the doc
      return this.datatable.datamanager.getData(i)?.[0]?.doc
    }).filter((i) => i != undefined);

    for (var ri = 0; ri < this.grid_rows.length; ri++) {
      const doc = this.grid_rows[ri].doc
      const checked = checked_docs.some(d => d.name === doc.name)
      this.grid_rows[ri].doc.__checked = checked ? 1 : 0;
    }
    
    this.refresh_remove_rows_button();
  }

  delete_rows() {
		var dirty = false;

		let tasks = [];
    let selected_children = this.get_selected_children();
		selected_children.forEach((doc) => {
			tasks.push(() => {
				if (!this.frm) {
					this.df.data = this.get_data();
          this.df.data = this.df.data.filter((row) => row.idx != doc.idx);
        }
				this.grid_rows_by_docname[doc.name].remove();
				dirty = true;
			});
			tasks.push(() => frappe.timeout(0.1));
		});

		if (!this.frm) {
			tasks.push(() => {
				// reorder idx of df.data
				this.df.data.forEach((row, index) => (row.idx = index + 1));
			});
		}

		tasks.push(() => {
      if (dirty) {
				this.refresh();
				this.frm &&
					this.frm.script_manager.trigger(this.df.fieldname + "_delete", this.doctype);
			}
		});

    tasks.push(() => {
      // Uncheck all after remove, can this run after tasks??
      this.datatable.rowmanager.checkAll(false)
    })

    frappe.run_serially(tasks);

		if (selected_children.length == this.grid_pagination.page_length) {
			this.scroll_to_top();
		}
	}

	delete_all_rows() {
		frappe.confirm(__("Are you sure you want to delete all rows?"), () => {
			this.frm.doc[this.df.fieldname] = [];
			this.grid_rows = [];
			this.refresh();
			this.frm &&
				this.frm.script_manager.trigger(this.df.fieldname + "_delete", this.doctype);
      this.frm && this.frm.dirty();
      // Uncheck all after remove
      this.datatable.rowmanager.checkAll(false)
			this.scroll_to_top();
		});
	}

	scroll_to_top() {
		frappe.utils.scroll_to(this.wrapper);
	}
  
  select_row(name) {
    this.grid_rows_by_docname[name].select();
  }

  remove_all() {
    this.grid_rows.forEach((row) => {
			row.remove();
		});
  }

  refresh_remove_rows_button() {
		if (this.df.cannot_delete_rows) {
			return;
		}

		this.remove_rows_button.toggleClass(
			"hidden",
			this.datatable.rowmanager.getCheckedRows().length ? false : true
    );

    let select_all_checkbox_checked = $(this.datatable.header).find(
      ".dt-cell.dt-cell--col-0.dt-cell--header.dt-cell--header-0 input[type=checkbox]:checked:first"
    ).length
    let show_delete_all_btn =
			select_all_checkbox_checked && this.data.length > this.get_selected_children().length;
    this.remove_all_rows_button.toggleClass("hidden", !show_delete_all_btn);
	}

	get_selected() {
		return (this.grid_rows || [])
			.map((row) => {
				return row.doc.__checked ? row.doc.name : null;
			})
			.filter((d) => {
				return d;
			});
	}

  get_selected_children() {
		return (this.grid_rows || [])
			.map((row) => {
				return row.doc.__checked ? row.doc : null;
			})
			.filter((d) => {
				return d;
			});
	}

  reset_grid() {
    this.visible_columns = [];
    this.grid_rows = [];

		this.refresh();
  }

  make_head() {
		if (this.prevent_build) return;

    this.datatable_columns = []
		new DatagridRow({
			parent_df: this.df,
			docfields: this.docfields,
			frm: this.frm,
			grid: this,
      configure_columns: true,
    });
    
    // TODO: update to 20
    // TODO: v15 if filter applied keep search
    this.datatable.updateOptions({ inlineFilters: this?.data?.length >= 5 })

    // TODO: Check how to keep filters on next page
    // this.filter_applied && this.update_search_columns();
  }

  // update_search_columns() {}

  refresh() {
    if (this.frm && this.frm.setting_dependency) return;

    // TODO: Check filters and filtered data
    this.filter_applied = Object.keys(this.filter).length !== 0;
    this.data = this.get_data(this.filter_applied);

    // Setup fields goes first so setup_grid_configuration has fields
    this.setup_fields()
    !this.wrapper && this.make();

    if (this.frm) {
			this.display_status = frappe.perm.get_field_display_status(
				this.df,
				this.frm.doc,
				this.perm
			);
		} else if (this.df.is_web_form && this.control) {
			this.display_status = this.control.get_status();
		} else {
			// not in form
			this.display_status = "Write";
		}

    if (this.display_status === "None") return;

    // redraw
    this.make_head();

    if (!this.grid_rows) {
			this.grid_rows = [];
    }

    this.truncate_rows();
    this.grid_rows_by_docname = {};

    this.grid_pagination.update_page_numbers();
    // not using $rows just keep same signature for now
		this.render_result_rows("$rows", false);
    this.grid_pagination.check_page_number();
    
    // TODO: Check toolbar
    // TODO: Update datatable options for checks
		// toolbar
		// this.setup_toolbar();
		// this.toggle_checkboxes(this.display_status !== "Read");

    // TODO: Update datatable options for sortable
		// sortable
		// if (this.is_sortable() && !this.sortable_setup_done) {
		// 	this.make_sortable($rows);
		// 	this.sortable_setup_done = true;
		// }

		this.last_display_status = this.display_status;
    this.last_docname = this.frm && this.frm.docname;

    // red if mandatory
    this.form_grid.toggleClass("error", !!(this.df.reqd && !(this.data && this.data.length)));

    this.refresh_remove_rows_button();

		this.wrapper.trigger("change");
  }

  render_result_rows(_$rows, append_row) {
		let result_length = this.grid_pagination.get_result_length();
		let page_index = this.grid_pagination.page_index;
		let page_length = this.grid_pagination.page_length;
		if (!this.grid_rows) {
			return;
    }

    // store to build data
    const page_grid_rows = []

    // build rows
    for (var ri = (page_index - 1) * page_length; ri < result_length; ri++) {
			var d = this.data[ri];
			if (!d) {
				return;
			}
			if (d.idx === undefined) {
				d.idx = ri + 1;
			}
			if (d.name === undefined) {
				d.name = "row " + d.idx;
      }
      let grid_row;
			if (this.grid_rows[ri] && !append_row) {
				grid_row = this.grid_rows[ri];
        grid_row.doc = d;
        grid_row.refresh();
        page_grid_rows.push(grid_row)
			} else {
				grid_row = new DatagridRow({
					// parent: $rows,
					parent_df: this.df,
					docfields: this.docfields,
					doc: d,
					frm: this.frm,
					grid: this,
        });
        this.grid_rows[ri] = grid_row;
        page_grid_rows.push(grid_row)
      }

      this.grid_rows_by_docname[d.name] = grid_row;
    }

    // build data with rows
    this.datatable_data = []
    for (let i = 0; i < page_grid_rows.length; i++) {
      const row = page_grid_rows[i]
      const doc = row.doc
      const data = []

      for (let i = 0; i < this.datatable_columns.length; i++) {
        const datatable_column = this.datatable_columns[i]
        
        // TODO: Check if can be removed
        if (datatable_column.id === "configure_button") {
          continue
        } 
        const value = doc[datatable_column.field]

        data.push({
					name: doc.name,
					doctype: datatable_column.docfield.parent,
          fieldname: datatable_column.docfield.fieldname,
					content: value,
          doc: doc,
          row: row,
          format: (value) => {
            return frappe.format(value, datatable_column.docfield, null, doc);
          },
				})
      }

      this.datatable_data.push(data)
    }

    this.datatable.refresh(this.datatable_data, this.datatable_columns)
  }

  // setup_toolbar() {}

  truncate_rows() {
		if (this.grid_rows.length > this.data.length) {
			this.grid_rows.splice(this.data.length);
		}
	}

  setup_fields() {
    // reset docfield
    if (this.frm && this.frm.docname) {
      // use doc specific docfield object
      this.df = frappe.meta.get_docfield(
        this.frm.doctype,
        this.df.fieldname,
        this.frm.docname
      );
    } else {
      // use non-doc specific docfield
      if (this.df.options) {
        this.df =
          frappe.meta.get_docfield(this.df.options, this.df.fieldname) ||
          this.df ||
          null;
      }
    }

    if (this.doctype && this.frm) {
      this.docfields = frappe.meta.get_docfields(this.doctype, this.frm.docname);
    } else {
      // fields given in docfield
      this.docfields = this.df.fields;
    }

    this.docfields.forEach((df) => {
      this.fields_map[df.fieldname] = df;
    });
  }

  // refresh_row(docname) {}

  // make_sortable($rows) {}

  // TODO: check filtered data
  get_data(filter_field) {
		let data = [];
		// if (filter_field) {
		// 	data = this.get_filtered_data();
		// } else {
		// 	data = this.frm
		// 		? this.frm.doc[this.df.fieldname] || []
		// 		: this.df.data || this.get_modal_data();
		// }
    data = this.frm.doc[this.df.fieldname] || []
		return data;
  }
  
  // get_filtered_data() {}

  // get_data_based_on_fieldtype(df, data, value) {}

	// get_modal_data() {}

  // set_column_disp(fieldname, show) {}

  // set_editable_grid_column_disp(fieldname, show) {}

  // toggle_reqd(fieldname, reqd) {}

  // toggle_enable(fieldname, enable) { }

  // toggle_display(fieldname, show) { }

  // toggle_checkboxes(enable) { }

  get_docfield(fieldname) {
		return frappe.meta.get_docfield(
			this.doctype,
			fieldname,
			this.frm ? this.frm.docname : null
		);
  }

  get_row(key) {
		if (typeof key == "number") {
			if (key < 0) {
				return this.grid_rows[this.grid_rows.length + key];
			} else {
				return this.grid_rows[key];
			}
		} else {
			return this.grid_rows_by_docname[key];
		}
  }

  get_grid_row(key) {
		return this.get_row(key);
	}

  get_field(fieldname) {
		// Note: workaround for get_query
		if (!this.fieldinfo[fieldname]) this.fieldinfo[fieldname] = {};
		return this.fieldinfo[fieldname];
	}

  set_value(fieldname, value, doc) {
		if (this.display_status !== "None" && this.grid_rows_by_docname[doc.name]) {
			this.grid_rows_by_docname[doc.name].refresh_field(fieldname, value);
		}
	}

	setup_add_row() {
		this.wrapper.find(".grid-add-row").click(() => {
			this.add_new_row(null, true);
			return false;
		});
	}

  // NOTE: Changed signature
  add_new_row(idx, go_to_last_page = false, go_to_first_page = false) {
    // TODO: Check non editable datatale
    if (go_to_last_page) {
      this.grid_pagination.go_to_last_page_to_add_row();
    } else if (go_to_first_page) {
      this.grid_pagination.go_to_page(1);
    }

		if (this.frm) {
      var d = frappe.model.add_child(
        this.frm.doc,
        this.df.options,
        this.df.fieldname,
        idx
      );
      // if (copy_doc) {
      //   d = this.duplicate_row(d, copy_doc);
      // }
      d.__unedited = true;
      this.frm.script_manager.trigger(this.df.fieldname + "_add", d.doctype, d.name);
      this.refresh();
    } else {
			if (!this.df.data) {
				this.df.data = this.get_data() || [];
			}
			this.df.data.push({ idx: this.df.data.length + 1, __islocal: true });
			this.refresh();
    }
    
    // if (show) {
    //   if (idx) {
    //     // always open inserted rows
    //     this.wrapper
    //       .find("[data-idx='" + idx + "']")
    //       .data("grid_row")
    //       .toggle_view(true, callback);
    //   } else {
    //     if (!this.allow_on_grid_editing()) {
    //       // open last row only if on-grid-editing is disabled
    //       this.wrapper
    //         .find(".grid-row:last")
    //         .data("grid_row")
    //         .toggle_view(true, callback);
    //     }
    //   }
    // }

		return d;
  }

  // renumber_based_on_dom() {}

  // duplicate_row(d, copy_doc) {}

  // set_focus_on_row(idx) { }

  setup_visible_columns() {
		if (this.visible_columns && this.visible_columns.length > 0) return;

		this.user_defined_columns = [];
		this.setup_user_defined_columns();
		let total_colsize = 1
		const fields =
      this.user_defined_columns && this.user_defined_columns.length > 0
        ? this.user_defined_columns
        : this.editable_fields || this.docfields;

		this.visible_columns = [];

		for (var ci in fields) {
			var _df = fields[ci];
      
			// get docfield if from fieldname
			let df =
				this.user_defined_columns && this.user_defined_columns.length > 0
					? _df
					: this.fields_map[_df.fieldname];

			if (
				df &&
				!df.hidden &&
				(this.editable_fields || df.in_list_view) &&
				((this.frm && this.frm.get_perm(df.permlevel, "read")) || !this.frm) &&
				!in_list(frappe.model.layout_fields, df.fieldtype)
			) {
				if (df.columns) {
					df.colsize = df.columns;
				} else {
					this.update_default_colsize(df);
				}

				// attach formatter on refresh
				if (
					df.fieldtype == "Link" &&
					!df.formatter &&
					df.parent &&
					frappe.meta.docfield_map[df.parent]
				) {
					const docfield = frappe.meta.docfield_map[df.parent][df.fieldname];
					if (docfield && docfield.formatter) {
						df.formatter = docfield.formatter;
					}
				}

				total_colsize += df.colsize;
				this.visible_columns.push([df, df.colsize]);
			}
		}
    
  }

  update_default_colsize(df) {
		var colsize = 2;
		switch (df.fieldtype) {
			case "Text":
				break;
			case "Small Text":
				colsize = 3;
				break;
			case "Check":
				colsize = 1;
		}
		df.colsize = colsize;
	}

  setup_user_defined_columns() {
		if (!this.frm) return;

    let user_settings = frappe.get_user_settings(this.frm.doctype, "GridView");
		if (user_settings && user_settings[this.doctype] && user_settings[this.doctype].length) {
			this.user_defined_columns = user_settings[this.doctype].map((row) => {
				let column = frappe.meta.get_docfield(this.doctype, row.fieldname);

				if (column) {
					column.in_list_view = 1;
					column.columns = row.columns;
					return column;
				}
			});
		}
  }

  is_editable() {
		return this.display_status == "Write" && !this.static_rows;
  }

  // is_sortable() {}

  // only_sortable(status) {}

  // set_multiple_add(link, qty) {}

  // setup_allow_bulk_edit() {}

  // setup_download() {}

  // add_custom_button(label, click, position = "bottom") {}

  // clear_custom_buttons() {}

  // update_docfield_property(fieldname, property, value) {}

  // DATATABLE

  get_editing_object(colIndex, rowIndex, value, parent, column, row, data) {
		const control = this.render_editing_input(colIndex, rowIndex, value, parent, column, row, data);
    if (!control) return false;

    control.$input.focus()
    
		return {
			// called when cell is being edited
      initValue: (value) => {
				return control.set_value(value);
			},
      // value to show in cell
      getValue() {
        return control.get_value()
      },
			// called when cell value is set
      setValue: (value) => {
				return control.set_value(value);
			},
		}
	}

	render_editing_input(colIndex, rowIndex, value, parent, column, row, data) {
		const datatable_column = this.datatable.getColumn(colIndex);
    const df = datatable_column.docfield
    
    const datagrid_row = data.find(d => d.fieldname === df.fieldname).row
    const datagrid_column = datagrid_row.columns[df.fieldname]

    datagrid_row.make_control(datagrid_column, parent)

    const field = datagrid_row.on_grid_fields_dict[df.fieldname]
    field.refresh()

    return field
  }

}