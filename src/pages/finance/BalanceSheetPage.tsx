import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { motion } from "framer-motion";

const balanceSheetData = [
    {
        type_asset: "Current Asset",
        liabilities: "Accounts Payable",
        current_fixed_others: "Cash, Inventory",
        current_liabilities: "Short-term Loans",
        long_term_liabilities: "Mortgage",
        owner_equity: "Owner's Capital"
    },
    {
        type_asset: "Fixed Asset",
        liabilities: "Long-term Debt",
        current_fixed_others: "Machinery, Vehicles",
        current_liabilities: "Accrued Expenses",
        long_term_liabilities: "Equipment Loan",
        owner_equity: "Retained Earnings"
    },
    {
        type_asset: "Other Asset",
        liabilities: "Deferred Tax",
        current_fixed_others: "Prepaid Expenses",
        current_liabilities: "Taxes Payable",
        long_term_liabilities: "Bond Payable",
        owner_equity: "Shareholder Equity"
    },
];

export default function BalanceSheetPage() {
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
                        Balance <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Sheet</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
                        View assets, liabilities, and owner equity for your business.
                    </p>
                </motion.div>

                <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg mb-12">
                    <CardHeader>
                        <CardTitle className="text-3xl font-bold">Balance Sheet Table</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Type Asset</TableHead>
                                    <TableHead>Liabilities</TableHead>
                                    <TableHead>Current/Fixed/Others</TableHead>
                                    <TableHead>Current Liabilities</TableHead>
                                    <TableHead>Long-term Liabilities</TableHead>
                                    <TableHead>Owner Equity</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {balanceSheetData.map((row, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>{row.type_asset}</TableCell>
                                        <TableCell>{row.liabilities}</TableCell>
                                        <TableCell>{row.current_fixed_others}</TableCell>
                                        <TableCell>{row.current_liabilities}</TableCell>
                                        <TableCell>{row.long_term_liabilities}</TableCell>
                                        <TableCell>{row.owner_equity}</TableCell>
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