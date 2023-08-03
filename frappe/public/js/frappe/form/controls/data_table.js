import Grid from "../grid";

frappe.ui.form.ControlDataTable = class ControlDataTable extends frappe.ui.form.Control {

	make() {
		super.make()

    // TODO: Let it be a grid for now will change for datagrid later
		this.grid = new Grid({
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