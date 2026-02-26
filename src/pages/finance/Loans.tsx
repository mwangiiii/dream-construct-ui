import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const loansData = [
	{
		loan_start_date: "2026-01-01",
		lender_name: "ABC Bank",
		loan_type: "Term Loan",
		facility_ref: "FAC-001",
		purpose: "Project",
		principal_approved_kes: 1000000,
		interest_rate: 12,
		interest_type: "Fixed",
		tenure_months: 24,
		repayment_frequency: "Monthly",
		opening_balance: 1000000,
		installment_due: 50000,
		principal_portion: 40000,
		interest_portion: 10000,
		interest_deductible: "Yes",
		fees_and_charges: 2000,
		total_due: 52000,
		due_date: "2026-02-01",
		amount_paid: 52000,
		payment_date: "2026-02-01",
		closing_balance: 960000,
		payment_status: "Paid",
		days_in_arrears: 0,
		next_due_date: "2026-03-01",
		date_period: "2026-Q1"
	},
	{
		loan_start_date: "2026-01-15",
		lender_name: "XYZ Finance",
		loan_type: "Asset Finance",
		facility_ref: "FAC-002",
		purpose: "Asset",
		principal_approved_kes: 500000,
		interest_rate: 10,
		interest_type: "Variable",
		tenure_months: 12,
		repayment_frequency: "Quarterly",
		opening_balance: 500000,
		installment_due: 130000,
		principal_portion: 120000,
		interest_portion: 10000,
		interest_deductible: "No",
		fees_and_charges: 1500,
		total_due: 131500,
		due_date: "2026-04-01",
		amount_paid: 0,
		payment_date: "",
		closing_balance: 500000,
		payment_status: "Due",
		days_in_arrears: 10,
		next_due_date: "2026-07-01",
		date_period: "2026-Q2"
	},
];

export default function LoansPage() {
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
						Loans <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Tracking</span>
					</h1>
					<p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
						Track loan details, repayments, balances, and arrears for each facility.
					</p>
				</motion.div>

				<Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg mb-12 overflow-x-auto">
					<CardHeader>
						<CardTitle className="text-3xl font-bold">Loans Table</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Loan Start Date</TableHead>
									<TableHead>Lender Name</TableHead>
									<TableHead>Loan Type</TableHead>
									<TableHead>Facility Ref</TableHead>
									<TableHead>Purpose</TableHead>
									<TableHead>Principal Approved (KES)</TableHead>
									<TableHead>Interest Rate (% P.A.)</TableHead>
									<TableHead>Interest Type</TableHead>
									<TableHead>Tenure (Months)</TableHead>
									<TableHead>Repayment Frequency</TableHead>
									<TableHead>Opening Balance</TableHead>
									<TableHead>Installment Due</TableHead>
									<TableHead>Principal Portion</TableHead>
									<TableHead>Interest Portion</TableHead>
									<TableHead>Interest Deductible</TableHead>
									<TableHead>Fees and Charges</TableHead>
									<TableHead>Total Due</TableHead>
									<TableHead>Due Date</TableHead>
									<TableHead>Amount Paid</TableHead>
									<TableHead>Payment Date</TableHead>
									<TableHead>Closing Balance</TableHead>
									<TableHead>Payment Status</TableHead>
									<TableHead>Days in Arrears</TableHead>
									<TableHead>Next Due Date</TableHead>
									<TableHead>Date Period</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{loansData.map((row, idx) => (
									<TableRow key={idx}>
										<TableCell>{row.loan_start_date}</TableCell>
										<TableCell>{row.lender_name}</TableCell>
										<TableCell>{row.loan_type}</TableCell>
										<TableCell>{row.facility_ref}</TableCell>
										<TableCell>{row.purpose}</TableCell>
										<TableCell className="font-mono">{row.principal_approved_kes.toLocaleString()}</TableCell>
										<TableCell>{row.interest_rate}%</TableCell>
										<TableCell>{row.interest_type}</TableCell>
										<TableCell>{row.tenure_months}</TableCell>
										<TableCell>{row.repayment_frequency}</TableCell>
										<TableCell className="font-mono">{row.opening_balance.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.installment_due.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.principal_portion.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.interest_portion.toLocaleString()}</TableCell>
										<TableCell>{row.interest_deductible}</TableCell>
										<TableCell className="font-mono">{row.fees_and_charges.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.total_due.toLocaleString()}</TableCell>
										<TableCell>{row.due_date}</TableCell>
										<TableCell className="font-mono">{row.amount_paid.toLocaleString()}</TableCell>
										<TableCell>{row.payment_date || "-"}</TableCell>
										<TableCell className="font-mono">{row.closing_balance.toLocaleString()}</TableCell>
										<TableCell>{row.payment_status}</TableCell>
										<TableCell>{row.days_in_arrears}</TableCell>
										<TableCell>{row.next_due_date}</TableCell>
										<TableCell>{row.date_period}</TableCell>
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
