import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const fixedAssetDepreciationData = [
	{
		assets_number: "A-001",
		class: "Machinery",
		name: "Excavator",
		description: "Heavy duty excavator",
		location: "Site 1",
		cost: 500000,
		transaction_code: "TX-001",
		transaction_date: "2026-01-10",
		start_date: "2026-01-15",
		useful_life_years: 10,
		salvage_value: 50000,
		depreciation_method: "Straight Line",
		years: 1,
		previous_depreciation: 45000,
		annual_depreciation: 45000,
		year_and_date: "2026"
	},
	{
		assets_number: "A-002",
		class: "Vehicle",
		name: "Truck",
		description: "Transport truck",
		location: "Site 2",
		cost: 300000,
		transaction_code: "TX-002",
		transaction_date: "2026-02-01",
		start_date: "2026-02-05",
		useful_life_years: 8,
		salvage_value: 30000,
		depreciation_method: "Declining Balance",
		years: 1,
		previous_depreciation: 35000,
		annual_depreciation: 35000,
		year_and_date: "2026"
	},
	{
		assets_number: "A-003",
		class: "Equipment",
		name: "Generator",
		description: "Backup generator",
		location: "Site 3",
		cost: 150000,
		transaction_code: "TX-003",
		transaction_date: "2026-02-20",
		start_date: "2026-02-25",
		useful_life_years: 5,
		salvage_value: 20000,
		depreciation_method: "Straight Line",
		years: 1,
		previous_depreciation: 26000,
		annual_depreciation: 26000,
		year_and_date: "2026"
	},
];

export default function FixedAssetEquipmentDepreciationPage() {
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
						Fixed Asset Equipment <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Depreciation</span>
					</h1>
					<p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
						Track asset depreciation, methods, and annual calculations.
					</p>
				</motion.div>

				<Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg mb-12">
					<CardHeader>
						<CardTitle className="text-3xl font-bold">Fixed Asset Equipment Depreciation Table</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Assets Number</TableHead>
									<TableHead>Class</TableHead>
									<TableHead>Name</TableHead>
									<TableHead>Description</TableHead>
									<TableHead>Location</TableHead>
									<TableHead>Cost</TableHead>
									<TableHead>Transaction Code</TableHead>
									<TableHead>Transaction Date</TableHead>
									<TableHead>Start Date</TableHead>
									<TableHead>Useful Life Years</TableHead>
									<TableHead>Salvage Value</TableHead>
									<TableHead>Depreciation Method</TableHead>
									<TableHead>Years</TableHead>
									<TableHead>Previous Depreciation</TableHead>
									<TableHead>Annual Depreciation</TableHead>
									<TableHead>Year and Date</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{fixedAssetDepreciationData.map((row, idx) => (
									<TableRow key={idx}>
										<TableCell>{row.assets_number}</TableCell>
										<TableCell>{row.class}</TableCell>
										<TableCell>{row.name}</TableCell>
										<TableCell className="text-muted-foreground">{row.description}</TableCell>
										<TableCell>{row.location}</TableCell>
										<TableCell className="font-mono">{row.cost.toLocaleString()}</TableCell>
										<TableCell>{row.transaction_code}</TableCell>
										<TableCell>{row.transaction_date}</TableCell>
										<TableCell>{row.start_date}</TableCell>
										<TableCell>{row.useful_life_years}</TableCell>
										<TableCell className="font-mono">{row.salvage_value.toLocaleString()}</TableCell>
										<TableCell>{row.depreciation_method}</TableCell>
										<TableCell>{row.years}</TableCell>
										<TableCell className="font-mono">{row.previous_depreciation.toLocaleString()}</TableCell>
										<TableCell className="font-mono">{row.annual_depreciation.toLocaleString()}</TableCell>
										<TableCell>{row.year_and_date}</TableCell>
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
