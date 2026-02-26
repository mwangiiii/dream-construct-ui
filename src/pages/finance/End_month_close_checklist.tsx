import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const endMonthCloseChecklistData = [
	{
		year: 2026,
		quarter: "Q1",
		month: "February",
		task_number: "T-001",
		description: "Reconcile bank statements",
		assignee: "John Doe",
		due_date: "2026-02-28",
		status: "Completed",
		last_update: "2026-02-27"
	},
	{
		year: 2026,
		quarter: "Q1",
		month: "February",
		task_number: "T-002",
		description: "Close accounts payable",
		assignee: "Jane Smith",
		due_date: "2026-02-28",
		status: "Pending",
		last_update: "2026-02-26"
	},
	{
		year: 2026,
		quarter: "Q1",
		month: "February",
		task_number: "T-003",
		description: "Review payroll entries",
		assignee: "Alice Brown",
		due_date: "2026-02-28",
		status: "In Progress",
		last_update: "2026-02-25"
	},
];

export default function EndMonthCloseChecklistPage() {
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
						End Month Close <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Checklist</span>
					</h1>
					<p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
						Track month-end closing tasks, assignees, and status.
					</p>
				</motion.div>

				<Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg mb-12">
					<CardHeader>
						<CardTitle className="text-3xl font-bold">End Month Close Checklist Table</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Year</TableHead>
									<TableHead>Quarter</TableHead>
									<TableHead>Month</TableHead>
									<TableHead>Task Number</TableHead>
									<TableHead>Description</TableHead>
									<TableHead>Assignee</TableHead>
									<TableHead>Due Date</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Last Update</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{endMonthCloseChecklistData.map((row, idx) => (
									<TableRow key={idx}>
										<TableCell>{row.year}</TableCell>
										<TableCell>{row.quarter}</TableCell>
										<TableCell>{row.month}</TableCell>
										<TableCell>{row.task_number}</TableCell>
										<TableCell className="text-muted-foreground">{row.description}</TableCell>
										<TableCell>{row.assignee}</TableCell>
										<TableCell>{row.due_date}</TableCell>
										<TableCell>
											<Badge variant="outline" className={
												row.status === "Completed"
													? "bg-green-500/20 text-green-300 border-green-500/30"
													: row.status === "Pending"
													? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
													: "bg-blue-500/20 text-blue-300 border-blue-500/30"
											}>
												{row.status}
											</Badge>
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
