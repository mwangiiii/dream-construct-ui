import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const inventoryData = [
	{
		factorial_code: "F-001",
		description: "Cement Bags",
		serial_number: "SN-1001",
		vendor: "ABC Supplies",
		quantity_of_item: 100,
		cost_per_quantity: 500,
		total_value: 50000,
		usage: "Foundation",
		date: "2026-02-20",
		serialnumber: "SN-1001",
		notes: "Used for phase 1."
	},
	{
		factorial_code: "F-002",
		description: "Steel Rods",
		serial_number: "SN-1002",
		vendor: "XYZ Metals",
		quantity_of_item: 50,
		cost_per_quantity: 1200,
		total_value: 60000,
		usage: "Superstructure",
		date: "2026-02-22",
		serialnumber: "SN-1002",
		notes: "Delivered on time."
	},
	{
		factorial_code: "F-003",
		description: "Paint Buckets",
		serial_number: "SN-1003",
		vendor: "LMN Hardware",
		quantity_of_item: 30,
		cost_per_quantity: 800,
		total_value: 24000,
		usage: "Finishing",
		date: "2026-02-25",
		serialnumber: "SN-1003",
		notes: "Awaiting usage."
	},
];

export default function InventoryPage() {
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
						Inventory <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Tracking</span>
					</h1>
					<p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
						Monitor inventory items, vendors, and usage across projects.
					</p>
				</motion.div>

				<Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg mb-12">
					<CardHeader>
						<CardTitle className="text-3xl font-bold">Inventory Table</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Factorial Code</TableHead>
									<TableHead>Description</TableHead>
									<TableHead>Serial Number</TableHead>
									<TableHead>Vendor</TableHead>
									<TableHead>Quantity of Item</TableHead>
									<TableHead>Cost per Quantity</TableHead>
									<TableHead>Total Value</TableHead>
									<TableHead>Usage</TableHead>
									<TableHead>Date</TableHead>
									<TableHead>Serialnumber</TableHead>
									<TableHead>Notes</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{inventoryData.map((row, idx) => (
									<TableRow key={idx}>
										<TableCell>{row.factorial_code}</TableCell>
										<TableCell className="text-muted-foreground">{row.description}</TableCell>
										<TableCell>{row.serial_number}</TableCell>
										<TableCell>{row.vendor}</TableCell>
										<TableCell className="font-mono">{row.quantity_of_item.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.cost_per_quantity.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.total_value.toLocaleString()}</TableCell>
										<TableCell>{row.usage}</TableCell>
										<TableCell>{row.date}</TableCell>
										<TableCell>{row.serialnumber}</TableCell>
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
