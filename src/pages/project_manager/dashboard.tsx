const ProjectManagerDashboard = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold mb-4">Project Manager Dashboard</h1>
      <p className="text-muted-foreground mb-6">
        Welcome! Here you can control all aspects of your projects: time, quality, and financials.
      </p>
      {/* Quick links or widgets for core PM functions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Example widgets - replace with real data/components */}
        <div className="glass p-6 rounded-lg shadow border border-border">
          <h2 className="font-semibold text-lg mb-2">Time Control</h2>
          <ul className="text-sm list-disc ml-5">
            <li>Define stages & assign workers</li>
            <li>Track attendance & progress</li>
            <li>Monitor weekly accomplishments</li>
          </ul>
        </div>
        <div className="glass p-6 rounded-lg shadow border border-border">
          <h2 className="font-semibold text-lg mb-2">Quality Control</h2>
          <ul className="text-sm list-disc ml-5">
            <li>Inspect goods, materials, work</li>
            <li>Log site visits & observations</li>
            <li>Approve phases & manage issues</li>
          </ul>
        </div>
        <div className="glass p-6 rounded-lg shadow border border-border">
          <h2 className="font-semibold text-lg mb-2">Financial Control</h2>
          <ul className="text-sm list-disc ml-5">
            <li>View costs & material usage</li>
            <li>Review stage financials</li>
            <li>Authorize payments post-approval</li>
          </ul>
        </div>
      </div>
      {/* Add more widgets/components as needed */}
    </div>
  );
};

export default ProjectManagerDashboard;
