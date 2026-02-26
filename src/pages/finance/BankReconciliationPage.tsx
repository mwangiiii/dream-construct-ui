import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const bankReconciliationData = [
    {
        bank_code: "1002",
        date: "2026-02-20",
        description: "Deposit from client",
        transaction_code: "TX-001",
        book_amount: 50000,
        bank_amount: 50000,
        difference: 0,
        reconciled: true,
        last_update: "2026-02-21"
    },
    {
        bank_code: "1001",
        date: "2026-02-22",
        description: "Payment to vendor",
        transaction_code: "TX-002",
        book_amount: 30000,
        bank_amount: 29500,
        difference: 500,
        reconciled: false,
        last_update: "2026-02-23"
    },
    {
        bank_code: "1002",
        date: "2026-02-25",
        description: "Interest credited",
        transaction_code: "TX-003",
        book_amount: 2000,
        bank_amount: 2000,
        difference: 0,
        reconciled: true,
        last_update: "2026-02-26"
    },
];

export default function BankReconciliationPage() {
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
                        Bank <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Reconciliation</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
                        Track and reconcile bank transactions, amounts, and differences.
                    </p>
                </motion.div>

                <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg mb-12">
                    <CardHeader>
                        <CardTitle className="text-3xl font-bold">Bank Reconciliation Table</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Bank Code</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Transaction Code</TableHead>
                                    <TableHead>Book Amount</TableHead>
                                    <TableHead>Bank Amount</TableHead>
                                    <TableHead>Difference</TableHead>
                                    <TableHead>Reconciled</TableHead>
                                    <TableHead>Last Update</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {bankReconciliationData.map((row, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono px-2 py-1 text-xs">{row.bank_code}</Badge>
                                        </TableCell>
                                        <TableCell>{row.date}</TableCell>
                                        <TableCell className="text-muted-foreground">{row.description}</TableCell>
                                        <TableCell>{row.transaction_code}</TableCell>
                                        <TableCell className="font-mono">{row.book_amount.toLocaleString()}</TableCell>
                                        <TableCell className="font-mono">{row.bank_amount.toLocaleString()}</TableCell>
                                        <TableCell className={row.difference === 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                                            {row.difference.toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={row.reconciled ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-red-500/20 text-red-300 border-red-500/30"}>
                                                {row.reconciled ? "Yes" : "No"}
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