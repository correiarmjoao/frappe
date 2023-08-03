export default class DatagridRow {
  constructor(opts) {
		this.on_grid_fields_dict = {};
		this.on_grid_fields = [];
		$.extend(this, opts);
		this.set_docfields();
		this.columns = {};
		this.columns_list = [];
		this.make();
  }

  make() {
		let me = this;
    let render_row = true;
		// this.row = $('<div class="data-row row"></div>')
		// 	.appendTo(this.wrapper)
		// 	.on("click", function (e) {
		// 		if (
		// 			$(e.target).hasClass("grid-row-check") ||
		// 			$(e.target).hasClass("row-index") ||
		// 			$(e.target).parent().hasClass("row-index")
		// 		) {
		// 			return;
		// 		}
		// 		if (me.grid.allow_on_grid_editing() && me.grid.is_editable()) {
		// 			// pass
		// 		} else {
		// 			me.toggle_view();
		// 			return false;
		// 		}
		// 	});

		render_row = this.render_row();
		if (!this.render_row) return;
	}

  set_docfields(update = false) {
		if (this.doc && this.parent_df.options) {
			frappe.meta.make_docfield_copy_for(
				this.parent_df.options,
				this.doc.name,
				this.docfields
			);
			const docfields = frappe.meta.get_docfields(this.parent_df.options, this.doc.name);
			if (update) {
				// to maintain references
				this.docfields.forEach((df) => {
					Object.assign(
						df,
						docfields.find((d) => d.fieldname === df.fieldname)
					);
				});
			} else {
				this.docfields = docfields;
			}
		}
  }

  select(checked) {
		this.doc.__checked = checked ? 1 : 0;
  }

  remove() {
		var me = this;
    if (this.grid.is_editable()) {
			if (this.frm) {
				// if (this.get_open_form()) {
				// 	this.hide_form();
				// }

				frappe
					.run_serially([
						() => {
							return this.frm.script_manager.trigger(
								"before_" + this.grid.df.fieldname + "_remove",
								this.doc.doctype,
								this.doc.name
							);
						},
            () => {
							frappe.model.clear_doc(this.doc.doctype, this.doc.name);

							this.frm.script_manager.trigger(
								this.grid.df.fieldname + "_remove",
								this.doc.doctype,
								this.doc.name
							);
							this.frm.dirty();
              this.grid.refresh();
						},
					])
					.catch((e) => {
						// aborted
						console.trace(e); // eslint-disable-line
					});
      } else {
        // TODO: CHECK WHAT THIS GOES...
				// let data = null;
				// if (this.grid.df.get_data) {
				// 	data = this.grid.df.get_data();
				// } else {
				// 	data = this.grid.df.data;
				// }

				// const index = data.findIndex((d) => d.name === me.doc.name);

				// if (index > -1) {
				// 	// mutate array directly,
				// 	// else the object reference will be lost
				// 	data.splice(index, 1);
				// }
				// // remap idxs
				// data.forEach(function (d, i) {
				// 	d.idx = i + 1;
				// });

				// this.grid.refresh();
			}
		}
  }
  
  refresh() {
		// update docfields for new record
		if (this.frm && this.doc && this.doc.__islocal) {
			this.set_docfields(true);
		}

		if (this.frm && this.doc) {
			this.doc = locals[this.doc.doctype][this.doc.name];
		}

		if (this.grid.template && !this.grid.meta.editable_grid) {
			this.render_template();
		} else {
			this.render_row(true);
		}

		// refresh form fields
		if (this.grid_form) {
			this.grid_form.layout && this.grid_form.layout.refresh(this.doc);
		}
	}

  render_row(refresh) {

		this.setup_columns();
		// this.add_open_form_button();
		// this.refresh_check();

		if (this.frm && this.doc) {
			$(this.frm.wrapper).trigger("grid-row-render", [this]);
		}

		return true;
  }

  setup_columns() {
		this.focus_set = false;

    this.grid.setup_visible_columns();
		let fields =
			this.grid.user_defined_columns && this.grid.user_defined_columns.length > 0
				? this.grid.user_defined_columns
				: this.docfields;

    this.grid.visible_columns.forEach((col, ci) => {
			// to get update df for the row
			let df = fields.find((field) => field?.fieldname === col[0].fieldname);

      // TODO: Add this also
      this.set_dependant_property(df);

			let colsize = col[1];

			let txt = this.doc
				? frappe.format(this.doc[df.fieldname], df, null, this.doc)
        : __(df.label);

			if (this.doc && df.fieldtype === "Select") {
				txt = __(txt);
      }
      
      let column = {};
      if (!this.columns[df.fieldname] && !this.show_search) {
        column = this.make_column(df, colsize, txt, ci);
      } else if (!this.columns[df.fieldname] && this.show_search) {
				// TODO: update table options for search
        // column = this.make_search_column(df, colsize);
      } else {
        column = this.columns[df.fieldname];
				this.refresh_field(df.fieldname, txt);
      }

			// TODO: background color for cell
			if (this.doc) {
				if (df.reqd && !txt) {
					// column.addClass("error");
				}
				if (column.is_invalid) {
					// column.addClass("invalid");
				} else if (df.reqd || df.bold) {
					// column.addClass("bold");
				}
			}
		});
  }

  set_dependant_property(df) {
		if (
			!df.reqd &&
			df.mandatory_depends_on &&
			this.evaluate_depends_on_value(df.mandatory_depends_on)
		) {
			df.reqd = 1;
		}

		if (
			!df.read_only &&
			df.read_only_depends_on &&
			this.evaluate_depends_on_value(df.read_only_depends_on)
		) {
			df.read_only = 1;
		}
  }

	// TODO: Check depends on value
  evaluate_depends_on_value(expression) {
		let out = null;
		let doc = this.doc;

		if (!doc) return;

		let parent = this.frm ? this.frm.doc : this.doc || null;

		if (typeof expression === "boolean") {
			out = expression;
		} else if (typeof expression === "function") {
			out = expression(doc);
		} else if (expression.substr(0, 5) == "eval:") {
			try {
				out = frappe.utils.eval(expression.substr(5), { doc, parent });
				if (parent && parent.istable && expression.includes("is_submittable")) {
					out = true;
				}
			} catch (e) {
				frappe.throw(__('Invalid "depends_on" expression'));
			}
		} else if (expression.substr(0, 3) == "fn:" && this.frm) {
			out = this.frm.script_manager.trigger(
				expression.substr(3),
				this.doctype,
				this.docname
			);
		} else {
			var value = doc[expression];
			if ($.isArray(value)) {
				out = !!value.length;
			} else {
				out = !!value;
			}
		}

		return out;
	}

  make_column(df, colsize, txt, ci) {
    if (!this.doc) {
      // this is a header
      this.grid.datatable_columns.push({
        id: df.fieldname,
        field: df.fieldname,
        name: txt,
        content: `${txt}${df.reqd ? '<span> *</span>' : ''}`,
        docfield: df,
        width: colsize,
        align: "left"
      })
		}

		let me = this;
    const col = {}

		col.df = df;
		col.column_index = ci;

		this.columns[df.fieldname] = col;
    this.columns_list.push(col);

		return col;
	}

  refresh_field(fieldname, txt) {
		let fields =
			this.grid.user_defined_columns && this.grid.user_defined_columns.length > 0
				? this.grid.user_defined_columns
				: this.docfields;

		let df = fields.find((col) => {
			return col?.fieldname === fieldname;
		});

		// format values if no frm
		if (df && this.doc) {
			txt = frappe.format(this.doc[fieldname], df, null, this.doc);
		}

		if (!txt && this.frm) {
      txt = frappe.format(this.doc[fieldname], df, null, this.frm.doc);
    }

    // TODO: Check if static value is being updated
		// reset static value

    let column = this.columns[fieldname];
		if (column) {
      if (df && df.reqd) {
        const datatable = this.grid.datatable
        const row_index = datatable.datamanager.data.findIndex((d) => d[0].name === this.doc.name)
        const row = datatable.datamanager.getRow(row_index)
        if (row) { // in case row has been removed
          const col_index = row.findIndex((r) => r.column?.docfield?.name === df.name)
					
					// TODO: Check rules to when this should trigger
          // NOTE: selectors are case sensitive and also add spaces
					// Store error state in row or cell, this needs to be removed on page changes/filters/removes
          if (!!(txt === null || txt === "")) {
            this.grid.datatable.style.setStyle(`.dt-cell--row-${row_index} > .dt-cell__content--col-${col_index}`, { border: "2px solid var(--red-400)" });
					} else {
            this.grid.datatable.style.removeStyle(`.dt-cell--row-${row_index} > .dt-cell__content--col-${col_index}`)
          }
        }
			}
		}

		let field = this.on_grid_fields_dict[fieldname];
		// reset field value
		if (field) {
			field.docname = this.doc.name;
			field.refresh();
		}

		// in form
		if (this.grid_form) {
			this.grid_form.refresh_field(fieldname);
		}
  }

  make_control(column, parent) {
    // TODO: Check if can "cache" the controll, don't think
    // if (column.field) return;

    var me = this,
      df = column.df;
    
    if (df.fieldtype == "Text Editor") {
			df = Object.assign({}, df);
			df.fieldtype = "Text";
    }

    var field = frappe.ui.form.make_control({
			df: df,
			parent: parent,
			only_input: true,
			with_link_btn: true,
			doc: this.doc,
			doctype: this.doc.doctype,
			docname: this.doc.name,
			frm: this.grid.frm,
			grid: this.grid,
			grid_row: this,
      value: this.doc[df.fieldname],
      align: "left"
		});

		// sync get_query
    field.get_query = this.grid.get_field(df.fieldname).get_query;
    
    field.refresh();
    column.field = field;
    this.on_grid_fields_dict[df.fieldname] = field;
		// this.on_grid_fields.push(field);
  }

}