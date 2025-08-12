'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { getMasters, updateMaster, deleteMaster } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Edit, Trash } from 'lucide-react'
import { useState } from 'react'
import { MasterDialog } from './master-dialog'

export function MastersTable() {
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const [editingMaster, setEditingMaster] = useState<any>(null)
  
  const { data: masters, isLoading } = useQuery({
    queryKey: ['masters'],
    queryFn: () => getMasters(user?.tenant_id || ''),
    enabled: !!user?.tenant_id,
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ masterId, isActive }: { masterId: string, isActive: boolean }) =>
      updateMaster(masterId, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masters'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteMaster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masters'] })
    },
  })

  if (isLoading) {
    return <div>Loading masters...</div>
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Specialization</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Reviews</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {masters?.map((master: any) => (
              <TableRow key={master.id}>
                <TableCell className="font-medium">{master.display_name}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {master.specialization?.slice(0, 2).map((spec: string) => (
                      <Badge key={spec} variant="secondary">
                        {spec}
                      </Badge>
                    ))}
                    {master.specialization?.length > 2 && (
                      <Badge variant="secondary">+{master.specialization.length - 2}</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{master.rating.toFixed(1)} ⭐</TableCell>
                <TableCell>{master.reviews_count}</TableCell>
                <TableCell>
                  <Badge variant={master.is_visible ? 'default' : 'secondary'}>
                    {master.is_visible ? 'Visible' : 'Hidden'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={master.is_active}
                    onCheckedChange={(checked) =>
                      toggleActiveMutation.mutate({ masterId: master.id, isActive: checked })
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingMaster(master)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(master.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!masters || masters.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No masters found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {editingMaster && (
        <MasterDialog
          open={!!editingMaster}
          onOpenChange={(open) => !open && setEditingMaster(null)}
          master={editingMaster}
        />
      )}
    </>
  )
}