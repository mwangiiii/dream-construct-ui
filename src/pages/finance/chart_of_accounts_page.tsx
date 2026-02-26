import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const chartOfAccounts = [
	{
		account_type: "Asset",
		category: "Current Asset",
		subcategory: "Cash",
		account_name: "Cash on Hand",
		description: "Physical cash held by the company",
		bank_name: "N/A",
		account_code: "1001",
		active: true,
	},
	{
		account_type: "Liability",
		category: "Current Liability",
		subcategory: "Accounts Payable",
		account_name: "Trade Payables",
		description: "Amounts owed to suppliers",
		bank_name: "N/A",
		account_code: "2001",
		active: true,
	},
	{
		account_type: "Equity",
		category: "Owner's Equity",
		subcategory: "Capital",
		account_name: "Owner's Capital",
		description: "Owner's investment in the business",
		bank_name: "N/A",
		account_code: "3001",
		active: true,
	},
	{
		account_type: "Asset",
		category: "Current Asset",
		subcategory: "Bank",
		account_name: "Bank Account",
		description: "Main business bank account",
		bank_name: "ABC Bank",
		account_code: "1002",
		active: false,
	},
];

export default function ChartOfAccountsPage() {
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
						Chart of <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Accounts</span>
					</h1>
					<p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
						A detailed listing of all accounts in the general ledger, grouped by type and category.
					</p>
				</motion.div>

				<Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
					<CardHeader>
						<CardTitle className="text-3xl font-bold">Accounts Table</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Account Type</TableHead>
									<TableHead>Category</TableHead>
									<TableHead>Subcategory</TableHead>
									<TableHead>Account Name</TableHead>
									<TableHead>Description</TableHead>
									<TableHead>Bank Name</TableHead>
									<TableHead>Account Code</TableHead>
									<TableHead>Active</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{chartOfAccounts.map((acc, idx) => (
									<TableRow key={idx}>
										<TableCell>{acc.account_type}</TableCell>
										<TableCell>{acc.category}</TableCell>
										<TableCell>{acc.subcategory}</TableCell>
										<TableCell className="font-semibold text-foreground">{acc.account_name}</TableCell>
										<TableCell className="text-muted-foreground">{acc.description}</TableCell>
										<TableCell>{acc.bank_name}</TableCell>
										<TableCell>
											<Badge variant="outline" className="font-mono px-2 py-1 text-xs">{acc.account_code}</Badge>
										</TableCell>
										<TableCell>
											{acc.active ? (
												<Badge variant="default" className="bg-green-500/20 text-green-300 border-green-500/30">Active</Badge>
											) : (
												<Badge variant="outline" className="bg-red-500/20 text-red-300 border-red-500/30">Inactive</Badge>
											)}
										</TableCell>
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
