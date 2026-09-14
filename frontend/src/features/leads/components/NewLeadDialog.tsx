import { useState, type FormEvent } from 'react'
import {
  type LucideIcon,
  Building2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Tags,
  UserPlus,
} from 'lucide-react'
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
    company_name: '', phone: '', email: '', city: '', state: '', segment_id: '', website: '',
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
          setForm({ company_name: '', phone: '', email: '', city: '', state: '', segment_id: '', website: '' })
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-4 text-primary" />
              Novo lead
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 px-6 pb-2">
            <div className="col-span-2 space-y-1.5">
              <FieldLabel icon={Building2}>Nome da empresa *</FieldLabel>
              <Input
                required
                value={form.company_name}
                onChange={(e) => set('company_name', e.target.value)}
                placeholder="Barbearia Imperial"
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel icon={Phone}>Telefone</FieldLabel>
              <Input
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="(34) 99999-9999"
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel icon={Mail}>Email</FieldLabel>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="contato@empresa.com"
              />
            </div>
            <div className="col-span-2 grid grid-cols-[1.4fr_1fr_0.6fr] gap-4">
              <div className="space-y-1.5">
                <FieldLabel icon={Tags}>Segmento</FieldLabel>
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
                <FieldLabel icon={MapPin}>Cidade</FieldLabel>
                <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Uberlândia" />
              </div>
              <div className="space-y-1.5">
                <FieldLabel icon={MapPin}>UF</FieldLabel>
                <Input
                  maxLength={2}
                  value={form.state}
                  onChange={(e) => set('state', e.target.value.toUpperCase())}
                  placeholder="MG"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={createLead.isPending}>
              <Plus />
              Criar lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FieldLabel({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <Label className="flex items-center gap-1.5">
      <Icon className="size-3.5 text-muted-foreground" />
      {children}
    </Label>
  )
}
