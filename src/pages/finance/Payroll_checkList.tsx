import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const payrollChecklistData = [
	{
		job_id: "J-001",
		employee_name: "John Doe",
		rate: 1000,
		time_worked: "160h",
		gross_pay: 160000,
		taxes_paye: 24000,
		tax_reduction: 4000,
		net_paye: 136000,
		due_date: "2026-02-28",
		paid_date: "2026-02-25",
		bank_code: "1002",
		serial_no: "S-1001",
		etims_code: "ETIMS-55555"
	},
	{
		job_id: "J-002",
		employee_name: "Jane Smith",
		rate: 1200,
		time_worked: "170h",
		gross_pay: 204000,
		taxes_paye: 30600,
		tax_reduction: 6000,
		net_paye: 167400,
		due_date: "2026-02-28",
		paid_date: "2026-02-27",
		bank_code: "1001",
		serial_no: "S-1002",
		etims_code: "ETIMS-66666"
	},
	{
		job_id: "J-003",
		employee_name: "Alice Brown",
		rate: 950,
		time_worked: "150h",
		gross_pay: 142500,
		taxes_paye: 21375,
		tax_reduction: 3500,
		net_paye: 117625,
		due_date: "2026-02-28",
		paid_date: "",
		bank_code: "1002",
		serial_no: "S-1003",
		etims_code: "ETIMS-77777"
	},
];

export default function PayrollChecklistPage() {
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
						Payroll <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Checklist</span>
					</h1>
					<p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
						Review payroll details, taxes, and payment status for all employees.
					</p>
				</motion.div>

				<Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg mb-12">
					<CardHeader>
						<CardTitle className="text-3xl font-bold">Payroll Checklist</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>JobID</TableHead>
									<TableHead>Employee Name</TableHead>
									<TableHead>Rate</TableHead>
									<TableHead>Time Worked</TableHead>
									<TableHead>Gross Pay</TableHead>
									<TableHead>Taxes PAYE</TableHead>
									<TableHead>Tax Reduction</TableHead>
									<TableHead>Net PAYE</TableHead>
									<TableHead>Due Date</TableHead>
									<TableHead>Paid Date</TableHead>
									<TableHead>Bank Code</TableHead>
									<TableHead>Serial No.</TableHead>
									<TableHead>Etims Code</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{payrollChecklistData.map((row, idx) => (
									<TableRow key={idx}>
										<TableCell>{row.job_id}</TableCell>
										<TableCell>{row.employee_name}</TableCell>
										<TableCell className="font-mono">{row.rate.toLocaleString()}</TableCell>
										<TableCell>{row.time_worked}</TableCell>
										<TableCell className="font-mono">{row.gross_pay.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.taxes_paye.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.tax_reduction.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.net_paye.toLocaleString()}</TableCell>
										<TableCell>{row.due_date}</TableCell>
										<TableCell>{row.paid_date || "-"}</TableCell>
										<TableCell>
											<Badge variant="outline" className="font-mono px-2 py-1 text-xs">{row.bank_code}</Badge>
										</TableCell>
										<TableCell>{row.serial_no}</TableCell>
										<TableCell>{row.etims_code}</TableCell>
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
