'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layouts/dashboard-layout'
import { Button } from '@/components/ui/button'
import { ServicesTable } from '@/components/dashboard/services-table'
import { ServiceDialog } from '@/components/dashboard/service-dialog'
import { Plus } from 'lucide-react'

export default function ServicesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Services</h2>
            <p className="text-muted-foreground">
              Manage your service offerings
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Service
          </Button>
        </div>

        <ServicesTable />

        <ServiceDialog 
          open={isDialogOpen} 
          onOpenChange={setIsDialogOpen}
        />
      </div>
    </DashboardLayout>
  )
}