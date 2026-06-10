'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { Briefcase, Building, MapPin, Loader2 } from 'lucide-react';

const COLORS = [
  '#8b5cf6',
  '#3b82f6',
  '#ec4899',
  '#10b981',
  '#f59e0b',
  '#6366f1',
];

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="w-full h-[calc(100vh-64px)] flex items-center justify-center bg-[var(--background)]">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[var(--background)] p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-500">
            Tổng quan Thị trường
          </h1>
          <p className="text-gray-400">
            Dữ liệu được làm mới liên tục từ Data Lakehouse
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6 flex items-center space-x-4">
            <div className="p-4 bg-purple-500/20 rounded-xl">
              <Briefcase className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Tổng Số Lượng Job</p>
              <h3 className="text-3xl font-bold">
                {data.totalJobs?.toLocaleString()}
              </h3>
            </div>
          </div>

          <div className="glass-panel p-6 flex items-center space-x-4">
            <div className="p-4 bg-blue-500/20 rounded-xl">
              <Building className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Công Ty Tuyển Dụng</p>
              <h3 className="text-3xl font-bold">
                {data.topCompanies?.length || 0}+
              </h3>
            </div>
          </div>

          <div className="glass-panel p-6 flex items-center space-x-4">
            <div className="p-4 bg-pink-500/20 rounded-xl">
              <MapPin className="w-8 h-8 text-pink-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Khu Vực Phân Bổ</p>
              <h3 className="text-3xl font-bold">
                {data.jobsByLocation?.length || 0}
              </h3>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Trend Line Chart */}
          <div className="glass-panel p-6">
            <h3 className="text-lg font-bold mb-6">
              Xu Hướng Cập Nhật Dữ Liệu
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trends}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#ffffff10"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="#9ca3af"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                    itemStyle={{ color: '#e5e7eb' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="jobs"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#8b5cf6' }}
                    activeDot={{ r: 6 }}
                    name="Số lượng"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Source Pie Chart */}
          <div className="glass-panel p-6">
            <h3 className="text-lg font-bold mb-6">
              Phân Bổ Theo Nguồn Tuyển Dụng
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.jobsBySource}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {data.jobsBySource?.map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Companies Bar Chart */}
          <div className="glass-panel p-6 lg:col-span-2">
            <h3 className="text-lg font-bold mb-6">
              Top Công Ty Tuyển Dụng Dữ Liệu
            </h3>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.topCompanies}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#ffffff10"
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis
                    type="number"
                    stroke="#9ca3af"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#9ca3af"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={150}
                    tickFormatter={(value) =>
                      value.length > 20 ? value.substring(0, 20) + '...' : value
                    }
                  />
                  <RechartsTooltip
                    cursor={{ fill: '#ffffff0a' }}
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar
                    dataKey="jobs"
                    fill="#3b82f6"
                    radius={[0, 4, 4, 0]}
                    barSize={24}
                    name="Số lượng job"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Salary Distribution Bar Chart */}
          <div className="glass-panel p-6 lg:col-span-2">
            <h3 className="text-lg font-bold mb-6">
              Phân Bổ Mức Lương (VNĐ)
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.salaryDistribution}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#ffffff10"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="#9ca3af"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip
                    cursor={{ fill: '#ffffff0a' }}
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar
                    dataKey="jobs"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    barSize={40}
                    name="Số lượng job"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
