import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const statementOfAccountData = [
	{
		description: "Project Payment",
		charges: 100000,
		credits: 80000,
		due_date: "2026-03-01",
		account_code: "1002",
		account_balance: 20000,
		last_update: "2026-02-20"
	},
	{
		description: "Consulting Fee",
		charges: 50000,
		credits: 50000,
		due_date: "2026-02-15",
		account_code: "1001",
		account_balance: 0,
		last_update: "2026-02-15"
	},
	{
		description: "Retainer",
		charges: 20000,
		credits: 0,
		due_date: "2026-03-20",
		account_code: "1002",
		account_balance: 20000,
		last_update: "2026-02-25"
	},
];

export default function StatementOfAccountPage() {
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
						Statement <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">of Account</span>
					</h1>
					<p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
						View charges, credits, balances, and due dates for each account.
					</p>
				</motion.div>

				<Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg mb-12">
					<CardHeader>
						<CardTitle className="text-3xl font-bold">Statement of Account Table</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Description</TableHead>
									<TableHead>Charges</TableHead>
									<TableHead>Credits</TableHead>
									<TableHead>Due Date</TableHead>
									<TableHead>Account Code</TableHead>
									<TableHead>Account Balance</TableHead>
									<TableHead>Last Update</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{statementOfAccountData.map((row, idx) => (
									<TableRow key={idx}>
										<TableCell className="text-muted-foreground">{row.description}</TableCell>
										<TableCell className="font-mono">{row.charges.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.credits.toLocaleString()}</TableCell>
										<TableCell>{row.due_date}</TableCell>
										<TableCell>
											<Badge variant="outline" className="font-mono px-2 py-1 text-xs">{row.account_code}</Badge>
										</TableCell>
										<TableCell className={row.account_balance > 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
											{row.account_balance.toLocaleString()}
										</TableCell>
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
