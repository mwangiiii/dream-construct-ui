import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const accountsPayableData = [
	{
		vendor_name: "ABC Supplies Ltd.",
		invoice_number: "INV-2024-001",
		etims_code: "ETIMS-12345",
		date: "2026-02-01",
		due_date: "2026-03-01",
		total_amount: 50000,
		paid_amount: 20000,
		balance: 30000,
		status: "open",
		retaining_percent: 10,
		date_of_payment: "2026-02-15",
		receiving_account_code: "1002",
		notes: "Partial payment made."
	},
	{
		vendor_name: "XYZ Contractors",
		invoice_number: "INV-2024-002",
		etims_code: "ETIMS-67890",
		date: "2026-01-10",
		due_date: "2026-02-10",
		total_amount: 75000,
		paid_amount: 75000,
		balance: 0,
		status: "paid",
		retaining_percent: 5,
		date_of_payment: "2026-02-09",
		receiving_account_code: "1001",
		notes: "Fully settled."
	},
	{
		vendor_name: "LMN Hardware",
		invoice_number: "INV-2024-003",
		etims_code: "ETIMS-54321",
		date: "2026-02-20",
		due_date: "2026-03-20",
		total_amount: 120000,
		paid_amount: 0,
		balance: 120000,
		status: "open",
		retaining_percent: 0,
		date_of_payment: "",
		receiving_account_code: "1002",
		notes: "Awaiting payment."
	},
];

export default function AccountsPayablePage() {
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
						Accounts <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Payable</span>
					</h1>
					<p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
						Track outstanding vendor invoices and payment status.
					</p>
				</motion.div>

				{/* Second Table: Accounts Payable Details */}
				<Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg mb-12">
					<CardHeader>
						<CardTitle className="text-3xl font-bold">Accounts Payable Details</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Vendor Name</TableHead>
									<TableHead>Invoice Number</TableHead>
									<TableHead>ETIMS Code</TableHead>
									<TableHead>Date</TableHead>
									<TableHead>Due Date</TableHead>
									<TableHead>Total Amount</TableHead>
									<TableHead>Paid Amount</TableHead>
									<TableHead>Balance</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Retaining %</TableHead>
									<TableHead>Date of Payment</TableHead>
									<TableHead>Receiving Account Code</TableHead>
									<TableHead>Notes</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{accountsPayableData.map((row, idx) => (
									<TableRow key={idx}>
										<TableCell>{row.vendor_name}</TableCell>
										<TableCell>{row.invoice_number}</TableCell>
										<TableCell>{row.etims_code}</TableCell>
										<TableCell>{row.date}</TableCell>
										<TableCell>{row.due_date}</TableCell>
										<TableCell className="font-mono">{row.total_amount.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.paid_amount.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.balance.toLocaleString()}</TableCell>
										<TableCell>
											{row.status === "paid" ? (
												<Badge variant="default" className="bg-green-500/20 text-green-300 border-green-500/30">Paid</Badge>
											) : row.status === "open" ? (
												<Badge variant="outline" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">Open</Badge>
											) : (
												<Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/30">Complete</Badge>
											)}
										</TableCell>
										<TableCell>{row.retaining_percent ? `${row.retaining_percent}%` : "-"}</TableCell>
										<TableCell>{row.date_of_payment || "-"}</TableCell>
										<TableCell>
											<Badge variant="outline" className="font-mono px-2 py-1 text-xs">{row.receiving_account_code}</Badge>
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