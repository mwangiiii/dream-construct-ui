import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const accountsReceivedData = [
	{
		client: "Acme Corp.",
		billing: "BILL-2026-001",
		etims_code: "ETIMS-11111",
		purpose: "Project Payment",
		date: "2026-02-01",
		due_date: "2026-03-01",
		amount_billed: 100000,
		amount_received: 80000,
		balance: 20000,
		aging: "30 days",
		retainings: 5,
		account_received: "1002",
		notes: "Partial payment received."
	},
	{
		client: "Beta Ltd.",
		billing: "BILL-2026-002",
		etims_code: "ETIMS-22222",
		purpose: "Consulting Fee",
		date: "2026-01-15",
		due_date: "2026-02-15",
		amount_billed: 50000,
		amount_received: 50000,
		balance: 0,
		aging: "0 days",
		retainings: 0,
		account_received: "1001",
		notes: "Fully paid."
	},
	{
		client: "Gamma Holdings",
		billing: "BILL-2026-003",
		etims_code: "ETIMS-33333",
		purpose: "Retainer",
		date: "2026-02-20",
		due_date: "2026-03-20",
		amount_billed: 20000,
		amount_received: 0,
		balance: 20000,
		aging: "6 days",
		retainings: 2,
		account_received: "1002",
		notes: "Awaiting payment."
	},
];

export default function AccountsReceivedPage() {
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
						Accounts <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Received</span>
					</h1>
					<p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
						Track client billings, receipts, and outstanding balances.
					</p>
				</motion.div>

				<Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg mb-12">
					<CardHeader>
						<CardTitle className="text-3xl font-bold">Accounts Received Details</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Client</TableHead>
									<TableHead>Billing</TableHead>
									<TableHead>ETIMS Code</TableHead>
									<TableHead>Purpose</TableHead>
									<TableHead>Date</TableHead>
									<TableHead>Due Date</TableHead>
									<TableHead>Amount Billed</TableHead>
									<TableHead>Amount Received</TableHead>
									<TableHead>Balance</TableHead>
									<TableHead>Aging</TableHead>
									<TableHead>Retainings</TableHead>
									<TableHead>Account Received</TableHead>
									<TableHead>Notes</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{accountsReceivedData.map((row, idx) => (
									<TableRow key={idx}>
										<TableCell>{row.client}</TableCell>
										<TableCell>{row.billing}</TableCell>
										<TableCell>{row.etims_code}</TableCell>
										<TableCell>{row.purpose}</TableCell>
										<TableCell>{row.date}</TableCell>
										<TableCell>{row.due_date}</TableCell>
										<TableCell className="font-mono">{row.amount_billed.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.amount_received.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.balance.toLocaleString()}</TableCell>
										<TableCell>{row.aging}</TableCell>
										<TableCell>{row.retainings ? `${row.retainings}%` : "-"}</TableCell>
										<TableCell>
											<Badge variant="outline" className="font-mono px-2 py-1 text-xs">{row.account_received}</Badge>
										</TableCell>
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