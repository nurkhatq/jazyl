'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createMaster, updateMaster } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

interface MasterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  master?: any
}

export function MasterDialog({ open, onOpenChange, master }: MasterDialogProps) {
  const { toast } = useToast()
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState({
    display_name: '',
    description: '',
    specialization: '',
    user_email: '',
    user_first_name: '',
    user_last_name: '',
  })

  useEffect(() => {
    if (master) {
      setFormData({
        display_name: master.display_name || '',
        description: master.description || '',
        specialization: master.specialization?.join(', ') || '',
        user_email: '',
        user_first_name: '',
        user_last_name: '',
      })
    }
  }, [master])

  const mutation = useMutation({
    mutationFn: (data: any) =>
      master
        ? updateMaster(master.id, data)
        : createMaster(user?.tenant_id || '', data),
    onSuccess: () => {
      toast({
        title: master ? 'Master Updated' : 'Master Created',
        description: 'The master has been successfully saved.',
      })
      queryClient.invalidateQueries({ queryKey: ['masters'] })
      onOpenChange(false)
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save master. Please try again.',
        variant: 'destructive',
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const data = {
      display_name: formData.display_name,
      description: formData.description,
      specialization: formData.specialization.split(',').map(s => s.trim()),
    }
    
    if (!master) {
      // Include user creation data for new master
      Object.assign(data, {
        user_email: formData.user_email,
        user_first_name: formData.user_first_name,
        user_last_name: formData.user_last_name,
      })
    }
    
    mutation.mutate(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{master ? 'Edit Master' : 'Add New Master'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="display_name">Display Name</Label>
            <Input
              id="display_name"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              required
            />
          </div>
          
          {!master && (
            <>
              <div>
                <Label htmlFor="user_email">Email</Label>
                <Input
                  id="user_email"
                  type="email"
                  value={formData.user_email}
                  onChange={(e) => setFormData({ ...formData, user_email: e.target.value })}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="user_first_name">First Name</Label>
                  <Input
                    id="user_first_name"
                    value={formData.user_first_name}
                    onChange={(e) => setFormData({ ...formData, user_first_name: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="user_last_name">Last Name</Label>
                  <Input
                    id="user_last_name"
                    value={formData.user_last_name}
                    onChange={(e) => setFormData({ ...formData, user_last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
            </>
          )}
          
          <div>
            <Label htmlFor="specialization">Specialization (comma-separated)</Label>
            <Input
              id="specialization"
              value={formData.specialization}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              placeholder="Haircut, Beard Trim, Coloring"
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}