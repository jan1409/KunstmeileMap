import { Link } from 'react-router-dom';

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Welcome</h1>
      <p className="mt-2 text-white/60">Quick actions:</p>
      <ul className="mt-2 list-disc pl-6 text-sm">
        <li><Link to="/admin/events" className="underline">Manage events</Link></li>
      </ul>
    </div>
  );
}
