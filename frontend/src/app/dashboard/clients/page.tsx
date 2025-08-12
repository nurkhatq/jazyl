'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layouts/dashboard-layout'
import { Input } from '@/components/ui/input'
import { ClientsTable } from '@/components/dashboard/clients-table'
import { Search } from 'lucide-react'

export default function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState('')

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Clients</h2>
          <p className="text-muted-foreground">
            View and manage your client base
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <ClientsTable searchTerm={searchTerm} />
      </div>
    </DashboardLayout>
  )
}