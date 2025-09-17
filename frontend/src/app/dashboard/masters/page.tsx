'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layouts/dashboard-layout'
import { Button } from '@/components/ui/button'
import { MastersTable } from '@/components/dashboard/masters-table'
import { MasterDialog } from '@/components/dashboard/master-dialog'
import { Plus } from 'lucide-react'

export default function MastersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Masters</h2>
            <p className="text-muted-foreground">
              Manage your team members
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Master
          </Button>
        </div>

        <MastersTable />

        <MasterDialog 
          open={isDialogOpen} 
          onOpenChange={setIsDialogOpen}
        />
      </div>
    </DashboardLayout>
  )
}