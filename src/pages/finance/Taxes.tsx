import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const taxesData = [
	{
		date: "2026-02-20",
		project_id: "P-001",
		counter_party: "Acme Corp.",
		kra_pin: "A123456789",
		transaction_type: "Invoice",
		ref_number: "INV-001",
		description: "Payment for services",
		gross_amount: 100000,
		vat: 16000,
		output_vat: 16000,
		input_vat: 0,
		net_amount: 84000,
		retention_percentage: 10,
		retention_amount: 10000,
		wht: 5,
		paye: 12000,
		nssf: 2000,
		nhif: 1500,
		housing_levy: 1000,
		deduction_category: "Statutory",
		allowable_deduction: "Yes",
		deduction_type: "PAYE",
		asset: "No",
		capital_allowance: 0,
		cash_in: 90000,
		cash_out: 10000,
		running_balance: 80000,
		tax_period: "2026-Q1"
	},
	{
		date: "2026-02-22",
		project_id: "P-002",
		counter_party: "Beta Ltd.",
		kra_pin: "B987654321",
		transaction_type: "Payment",
		ref_number: "PAY-002",
		description: "Consulting fee",
		gross_amount: 50000,
		vat: 8000,
		output_vat: 8000,
		input_vat: 0,
		net_amount: 42000,
		retention_percentage: 5,
		retention_amount: 2500,
		wht: 3,
		paye: 6000,
		nssf: 1000,
		nhif: 800,
		housing_levy: 500,
		deduction_category: "Statutory",
		allowable_deduction: "No",
		deduction_type: "WHT",
		asset: "Yes",
		capital_allowance: 2000,
		cash_in: 47000,
		cash_out: 3000,
		running_balance: 44000,
		tax_period: "2026-Q1"
	},
];

export default function TaxesPage() {
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
						Taxes <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Tracking</span>
					</h1>
					<p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
						Track tax details, deductions, and statutory payments for each transaction.
					</p>
				</motion.div>

				<Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg mb-12 overflow-x-auto">
					<CardHeader>
						<CardTitle className="text-3xl font-bold">Taxes Table</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Date</TableHead>
									<TableHead>Project ID</TableHead>
									<TableHead>Counter Party</TableHead>
									<TableHead>KRA PIN</TableHead>
									<TableHead>Transaction Type</TableHead>
									<TableHead>Ref Number</TableHead>
									<TableHead>Description</TableHead>
									<TableHead>Gross Amount (KES)</TableHead>
									<TableHead>VAT</TableHead>
									<TableHead>Output VAT</TableHead>
									<TableHead>Input VAT</TableHead>
									<TableHead>Net Amount</TableHead>
									<TableHead>Retention %</TableHead>
									<TableHead>Retention Amount (KES)</TableHead>
									<TableHead>WHT %</TableHead>
									<TableHead>PAYE</TableHead>
									<TableHead>NSSF</TableHead>
									<TableHead>NHIF</TableHead>
									<TableHead>Housing Levy</TableHead>
									<TableHead>Deduction Category</TableHead>
									<TableHead>Allowable Deduction</TableHead>
									<TableHead>Deduction Type</TableHead>
									<TableHead>Asset</TableHead>
									<TableHead>Capital Allowance</TableHead>
									<TableHead>Cash In</TableHead>
									<TableHead>Cash Out</TableHead>
									<TableHead>Running Balance</TableHead>
									<TableHead>Tax Period</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{taxesData.map((row, idx) => (
									<TableRow key={idx}>
										<TableCell>{row.date}</TableCell>
										<TableCell>{row.project_id}</TableCell>
										<TableCell>{row.counter_party}</TableCell>
										<TableCell>{row.kra_pin}</TableCell>
										<TableCell>{row.transaction_type}</TableCell>
										<TableCell>{row.ref_number}</TableCell>
										<TableCell className="text-muted-foreground">{row.description}</TableCell>
										<TableCell className="font-mono">{row.gross_amount.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.vat.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.output_vat.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.input_vat.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.net_amount.toLocaleString()}</TableCell>
										<TableCell>{row.retention_percentage}%</TableCell>
										<TableCell className="font-mono">{row.retention_amount.toLocaleString()}</TableCell>
										<TableCell>{row.wht}%</TableCell>
										<TableCell className="font-mono">{row.paye.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.nssf.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.nhif.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.housing_levy.toLocaleString()}</TableCell>
										<TableCell>{row.deduction_category}</TableCell>
										<TableCell>{row.allowable_deduction}</TableCell>
										<TableCell>{row.deduction_type}</TableCell>
										<TableCell>{row.asset}</TableCell>
										<TableCell className="font-mono">{row.capital_allowance.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.cash_in.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.cash_out.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.running_balance.toLocaleString()}</TableCell>
										<TableCell>{row.tax_period}</TableCell>
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
