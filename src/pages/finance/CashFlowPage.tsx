import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const cashFlowData = [
    {
        year: 2026,
        quarter: "Q1",
        month: "February",
        inflows: 200000,
        outflows: 150000,
        net_cash_flow: 50000,
        account_codes: "1001, 1002",
        etims_codes: "ETIMS-11111, ETIMS-22222",
        ending_balance: 250000,
        notes: "Strong inflow from project completions."
    },
    {
        year: 2026,
        quarter: "Q1",
        month: "January",
        inflows: 180000,
        outflows: 120000,
        net_cash_flow: 60000,
        account_codes: "1001",
        etims_codes: "ETIMS-33333",
        ending_balance: 200000,
        notes: "Lower outflows due to delayed purchases."
    },
    {
        year: 2025,
        quarter: "Q4",
        month: "December",
        inflows: 220000,
        outflows: 210000,
        net_cash_flow: 10000,
        account_codes: "1002",
        etims_codes: "ETIMS-44444",
        ending_balance: 140000,
        notes: "Year-end bonuses paid."
    },
];

export default function CashFlowPage() {
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
                        Cash <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Flow</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
                        Monitor inflows, outflows, and net cash position across periods.
                    </p>
                </motion.div>

                <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg mb-12">
                    <CardHeader>
                        <CardTitle className="text-3xl font-bold">Cash Flow Table</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Year</TableHead>
                                    <TableHead>Quarter</TableHead>
                                    <TableHead>Month</TableHead>
                                    <TableHead>Inflows</TableHead>
                                    <TableHead>Outflows</TableHead>
                                    <TableHead>Net Cash Flow</TableHead>
                                    <TableHead>Account Codes / Balance</TableHead>
                                    <TableHead>ETIMS Codes</TableHead>
                                    <TableHead>Ending Balance</TableHead>
                                    <TableHead>Notes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cashFlowData.map((row, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>{row.year}</TableCell>
                                        <TableCell>{row.quarter}</TableCell>
                                        <TableCell>{row.month}</TableCell>
                                        <TableCell className="font-mono">{row.inflows.toLocaleString()}</TableCell>
                                        <TableCell className="font-mono">{row.outflows.toLocaleString()}</TableCell>
                                        <TableCell className={row.net_cash_flow >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                                            {row.net_cash_flow >= 0 ? "+" : ""}{row.net_cash_flow.toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono px-2 py-1 text-xs">{row.account_codes}</Badge>
                                        </TableCell>
                                        <TableCell>{row.etims_codes}</TableCell>
                                        <TableCell className="font-mono">{row.ending_balance.toLocaleString()}</TableCell>
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