import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const jobPostingData = [
	{
		phase: "Foundation",
		stage: "Excavation",
		account_code: "2001",
		project_id: "P-001",
		description: "Site excavation and leveling",
		etims_code: "ETIMS-88888",
		budgeted_amount_paid: 50000,
		actual_amount_used: 48000,
		profit_loss: 2000,
		amount: 48000
	},
	{
		phase: "Superstructure",
		stage: "Concrete Pouring",
		account_code: "2002",
		project_id: "P-002",
		description: "Pouring concrete for columns",
		etims_code: "ETIMS-99999",
		budgeted_amount_paid: 80000,
		actual_amount_used: 85000,
		profit_loss: -5000,
		amount: 85000
	},
	{
		phase: "Finishing",
		stage: "Painting",
		account_code: "2003",
		project_id: "P-003",
		description: "Interior and exterior painting",
		etims_code: "ETIMS-10101",
		budgeted_amount_paid: 30000,
		actual_amount_used: 25000,
		profit_loss: 5000,
		amount: 25000
	},
];

export default function JobPostingPage() {
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
						Job <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Posting</span>
					</h1>
					<p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
						Track project phases, milestones, and financials for each job posting.
					</p>
				</motion.div>

				<Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg mb-12">
					<CardHeader>
						<CardTitle className="text-3xl font-bold">Job Posting Table</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Phase</TableHead>
									<TableHead>Stage / Milestone</TableHead>
									<TableHead>Account Code</TableHead>
									<TableHead>Project ID</TableHead>
									<TableHead>Description</TableHead>
									<TableHead>Etims Code</TableHead>
									<TableHead>Budgeted Amount Paid</TableHead>
									<TableHead>Actual Amount Used</TableHead>
									<TableHead>Profit/Loss</TableHead>
									<TableHead>Amount</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{jobPostingData.map((row, idx) => (
									<TableRow key={idx}>
										<TableCell>{row.phase}</TableCell>
										<TableCell>{row.stage}</TableCell>
										<TableCell>
											<Badge variant="outline" className="font-mono px-2 py-1 text-xs">{row.account_code}</Badge>
										</TableCell>
										<TableCell>{row.project_id}</TableCell>
										<TableCell className="text-muted-foreground">{row.description}</TableCell>
										<TableCell>{row.etims_code}</TableCell>
										<TableCell className="font-mono">{row.budgeted_amount_paid.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.actual_amount_used.toLocaleString()}</TableCell>
										<TableCell className={row.profit_loss >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
											{row.profit_loss >= 0 ? "+" : ""}{row.profit_loss.toLocaleString()}
										</TableCell>
										<TableCell className="font-mono">{row.amount.toLocaleString()}</TableCell>
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
