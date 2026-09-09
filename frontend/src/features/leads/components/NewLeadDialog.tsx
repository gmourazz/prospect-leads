import { useState, type FormEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSegments } from '@/features/segments/hooks/useSegments'
import { useCreateLead } from '../hooks/useLeads'

const NONE = '__none__'

export function NewLeadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: segments } = useSegments()
  const createLead = useCreateLead()
  const [form, setForm] = useState({
    company_name: '', phone: '', email: '', city: '', state: '', segment_id: '', website: '', instagram: '',
  })

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createLead.mutate(
      { ...form, segment_id: form.segment_id || undefined },
      {
        onSuccess: () => {
          onOpenChange(false)
          setForm({ company_name: '', phone: '', email: '', city: '', state: '', segment_id: '', website: '', instagram: '' })
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo lead</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 px-6 pb-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome da empresa *</Label>
              <Input
                required
                value={form.company_name}
                onChange={(e) => set('company_name', e.target.value)}
                placeholder="Barbearia Imperial"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="(34) 99999-9999"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="contato@empresa.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Segmento</Label>
              <Select value={form.segment_id || NONE} onValueChange={(v) => set('segment_id', v === NONE ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {segments?.data.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Uberlândia" />
            </div>
            <div className="space-y-1.5">
              <Label>UF</Label>
              <Input
                maxLength={2}
                value={form.state}
                onChange={(e) => set('state', e.target.value.toUpperCase())}
                placeholder="MG"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Instagram</Label>
              <Input
                value={form.instagram}
                onChange={(e) => set('instagram', e.target.value)}
                placeholder="https://instagram.com/…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={createLead.isPending}>Criar lead</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
