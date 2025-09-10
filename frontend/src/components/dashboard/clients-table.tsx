'use client'

import { useQuery } from '@tanstack/react-query'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getClients } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { format } from 'date-fns'
import { Eye } from 'lucide-react'

interface ClientsTableProps {
  searchTerm?: string
}

export function ClientsTable({ searchTerm }: ClientsTableProps) {
  const user = useAuthStore((state) => state.user)
  
  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients', searchTerm],
    // ИСПРАВЛЕНО: правильный порядок параметров - search, потом tenantId
    queryFn: () => getClients(searchTerm, user?.tenant_id),
    enabled: !!user?.tenant_id,
  })

  if (isLoading) {
    return <div>Loading clients...</div>
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Total Visits</TableHead>
            <TableHead>Total Spent</TableHead>
            <TableHead>Last Visit</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients?.map((client: any) => (
            <TableRow key={client.id}>
              <TableCell className="font-medium">
                {client.first_name} {client.last_name}
              </TableCell>
              <TableCell>{client.email}</TableCell>
              <TableCell>{client.phone}</TableCell>
              <TableCell>{client.total_visits}</TableCell>
              <TableCell>${client.total_spent?.toFixed(2) || '0.00'}</TableCell>
              <TableCell>
                {client.last_visit
                  ? format(new Date(client.last_visit), 'MMM d, yyyy')
                  : 'Never'}
              </TableCell>
              <TableCell>
                {client.is_vip && <Badge variant="default">VIP</Badge>}
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm">
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {(!clients || clients.length === 0) && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                {searchTerm ? 'No clients found matching your search' : 'No clients found'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}