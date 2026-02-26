import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { motion } from "framer-motion";

const incomeStatementData = [
	{
		revenue: 500000,
		gross: 480000,
		returns_and_allowance: 20000,
		net: 460000,
		cost_of_work: 300000,
		total: 300000,
		gross_profit_loss: 160000,
		expenses_total_net_income: 50000,
		other_income_total_net: 10000,
		start_date: "2026-01-01",
		end_date: "2026-02-28"
	},
	{
		revenue: 400000,
		gross: 390000,
		returns_and_allowance: 10000,
		net: 380000,
		cost_of_work: 250000,
		total: 250000,
		gross_profit_loss: 130000,
		expenses_total_net_income: 40000,
		other_income_total_net: 8000,
		start_date: "2025-11-01",
		end_date: "2025-12-31"
	},
];

export default function IncomeStatementPage() {
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
						Income <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Statement</span>
					</h1>
					<p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
						View revenue, expenses, profit/loss, and net income for each period.
					</p>
				</motion.div>

				<Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg mb-12">
					<CardHeader>
						<CardTitle className="text-3xl font-bold">Income Statement Table</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Revenue</TableHead>
									<TableHead>Gross</TableHead>
									<TableHead>Returns and Allowance</TableHead>
									<TableHead>Net</TableHead>
									<TableHead>Cost of Work</TableHead>
									<TableHead>Total</TableHead>
									<TableHead>Gross Profit / Loss</TableHead>
									<TableHead>Expenses: Total Net Income</TableHead>
									<TableHead>Other Income Total Net</TableHead>
									<TableHead>Start Date</TableHead>
									<TableHead>End Date</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{incomeStatementData.map((row, idx) => (
									<TableRow key={idx}>
										<TableCell className="font-mono">{row.revenue.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.gross.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.returns_and_allowance.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.net.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.cost_of_work.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.total.toLocaleString()}</TableCell>
										<TableCell className={row.gross_profit_loss >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
											{row.gross_profit_loss >= 0 ? "+" : ""}{row.gross_profit_loss.toLocaleString()}
										</TableCell>
										<TableCell className="font-mono">{row.expenses_total_net_income.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.other_income_total_net.toLocaleString()}</TableCell>
										<TableCell>{row.start_date}</TableCell>
										<TableCell>{row.end_date}</TableCell>
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
