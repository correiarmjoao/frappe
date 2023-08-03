import Datagrid from "../datagrid";

// TODO: Add missing methods
frappe.ui.form.ControlDataTable = class ControlDataTable extends frappe.ui.form.Control {

	make() {
		super.make()

		this.grid = new Datagrid({
			frm: this.frm,
			df: this.df,
			parent: this.wrapper,
			control: this,
		})

		if (this.frm) {
			this.frm.grids[this.frm.grids.length] = this;
		}
	}

	refresh_input() {
		this.grid.refresh()
	}

};