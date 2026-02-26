import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const changeOrdersData = [
	{
		project_id: "P-001",
		change_code: "CO-001",
		stage: "Excavation",
		description: "Additional excavation required",
		added_cost: 15000,
		new_timeline: "2026-03-15",
		approval: "Approved",
		initial_budget: 50000,
		new_budget: 65000,
		last_update: "2026-02-20",
		notes: "Approved by client."
	},
	{
		project_id: "P-002",
		change_code: "CO-002",
		stage: "Concrete Pouring",
		description: "Change in concrete mix",
		added_cost: 8000,
		new_timeline: "2026-04-01",
		approval: "Pending",
		initial_budget: 80000,
		new_budget: 88000,
		last_update: "2026-02-22",
		notes: "Awaiting approval."
	},
	{
		project_id: "P-003",
		change_code: "CO-003",
		stage: "Painting",
		description: "Extra coats requested",
		added_cost: 5000,
		new_timeline: "2026-03-25",
		approval: "Rejected",
		initial_budget: 30000,
		new_budget: 35000,
		last_update: "2026-02-25",
		notes: "Rejected due to budget constraints."
	},
];

export default function ChangeOrdersTrackingPage() {
	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-16">
			<div className="container mx-auto px-4">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8 }}
					className="mb-12 text-center"
				>
					<h1 className="text-5xl md:text-7xl font-bold mb-4 leading-tight">
						Change <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Orders Tracking</span>
					</h1>
					<p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
						Track project change orders, approvals, and budget adjustments.
					</p>
				</motion.div>

				<Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg mb-12">
					<CardHeader>
						<CardTitle className="text-3xl font-bold">Change Orders Tracking Table</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Project ID</TableHead>
									<TableHead>Change Code</TableHead>
									<TableHead>Stage</TableHead>
									<TableHead>Description</TableHead>
									<TableHead>Added Cost</TableHead>
									<TableHead>New Timeline</TableHead>
									<TableHead>Approval</TableHead>
									<TableHead>Initial Budget</TableHead>
									<TableHead>New Budget</TableHead>
									<TableHead>Last Update</TableHead>
									<TableHead>Notes</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{changeOrdersData.map((row, idx) => (
									<TableRow key={idx}>
										<TableCell>{row.project_id}</TableCell>
										<TableCell>{row.change_code}</TableCell>
										<TableCell>{row.stage}</TableCell>
										<TableCell className="text-muted-foreground">{row.description}</TableCell>
										<TableCell className="font-mono">{row.added_cost.toLocaleString()}</TableCell>
										<TableCell>{row.new_timeline}</TableCell>
										<TableCell>
											<Badge variant="outline" className={
												row.approval === "Approved"
													? "bg-green-500/20 text-green-300 border-green-500/30"
													: row.approval === "Pending"
													? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
													: "bg-red-500/20 text-red-300 border-red-500/30"
											}>
												{row.approval}
											</Badge>
										</TableCell>
										<TableCell className="font-mono">{row.initial_budget.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.new_budget.toLocaleString()}</TableCell>
										<TableCell>{row.last_update}</TableCell>
										<TableCell className="text-muted-foreground">{row.notes}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
