import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Select } from "@/components/ui/select";

const workInProgressData = [
	{
		project_id: "P-001",
		total_contract: 500000,
		cost_incurred: 200000,
		complete: "40%",
		earned_revenue: 180000,
		billed_to_date: 150000,
		billed_status: "overbilled",
		amount: 30000,
		account: "1002",
		code_receivable: "CR-001",
		last_update: "2026-02-20"
	},
	{
		project_id: "P-002",
		total_contract: 800000,
		cost_incurred: 600000,
		complete: "75%",
		earned_revenue: 600000,
		billed_to_date: 620000,
		billed_status: "underbilled",
		amount: 20000,
		account: "1001",
		code_receivable: "CR-002",
		last_update: "2026-02-22"
	},
	{
		project_id: "P-003",
		total_contract: 300000,
		cost_incurred: 100000,
		complete: "33%",
		earned_revenue: 99000,
		billed_to_date: 95000,
		billed_status: "overbilled",
		amount: 4000,
		account: "1002",
		code_receivable: "CR-003",
		last_update: "2026-02-25"
	},
];

export default function WorkInProgressPage() {
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
						Work <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">In Progress</span>
					</h1>
					<p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
						Track ongoing projects, contract values, and billing status.
					</p>
				</motion.div>

				<Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg mb-12">
					<CardHeader>
						<CardTitle className="text-3xl font-bold">Work In Progress Table</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Project ID</TableHead>
									<TableHead>Total Contract</TableHead>
									<TableHead>Cost Incurred</TableHead>
									<TableHead>Complete</TableHead>
									<TableHead>Earned Revenue</TableHead>
									<TableHead>Billed to Date</TableHead>
									<TableHead>Billed</TableHead>
									<TableHead>Amount</TableHead>
									<TableHead>Account</TableHead>
									<TableHead>Code Receivable</TableHead>
									<TableHead>Last Update</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{workInProgressData.map((row, idx) => (
									<TableRow key={idx}>
										<TableCell>{row.project_id}</TableCell>
										<TableCell className="font-mono">{row.total_contract.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.cost_incurred.toLocaleString()}</TableCell>
										<TableCell>{row.complete}</TableCell>
										<TableCell className="font-mono">{row.earned_revenue.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.billed_to_date.toLocaleString()}</TableCell>
										<TableCell>
											<Badge variant="outline" className={row.billed_status === "overbilled" ? "bg-red-500/20 text-red-300 border-red-500/30" : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"}>
												{row.billed_status.charAt(0).toUpperCase() + row.billed_status.slice(1)}
											</Badge>
										</TableCell>
										<TableCell className="font-mono">{row.amount.toLocaleString()}</TableCell>
										<TableCell>
											<Badge variant="outline" className="font-mono px-2 py-1 text-xs">{row.account}</Badge>
										</TableCell>
										<TableCell>{row.code_receivable}</TableCell>
										<TableCell>{row.last_update}</TableCell>
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
