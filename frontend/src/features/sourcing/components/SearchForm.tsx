import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSegments } from '@/features/segments/hooks/useSegments'
import { useCitiesByState, useStates } from '../hooks/useCities'

export const ALL_SEGMENTS = 'all'

export function SearchForm({
  onSearch,
  isLoading,
}: {
  onSearch: (params: { segmentId: string; city: string; state: string }) => void
  isLoading: boolean
}) {
  const { data: segments } = useSegments()
  const [segmentId, setSegmentId] = useState(ALL_SEGMENTS)
  const [state, setState] = useState('MG')
  const [city, setCity] = useState('Uberlândia')

  const { data: states } = useStates()
  const { data: cities, isLoading: citiesLoading } = useCitiesByState(state)

  // Changing state invalidates the chosen city: keeping "Uberlândia" while
  // SP is selected would silently search a city that isn't there.
  useEffect(() => {
    if (cities && cities.length > 0 && !cities.includes(city)) setCity(cities[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities])

  const segmentCount = segments?.data.filter((s) => s.is_active).length ?? 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (city) onSearch({ segmentId, city, state })
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="w-56 space-y-1.5">
        <Label>Segmento</Label>
        <Select value={segmentId} onValueChange={setSegmentId}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SEGMENTS}>Todos os segmentos</SelectItem>
            {segments?.data.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-24 space-y-1.5">
        <Label>UF</Label>
        <Select value={state} onValueChange={setState}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            {states?.map((uf) => (
              <SelectItem key={uf.sigla} value={uf.sigla}>{uf.sigla}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-60 space-y-1.5">
        <Label>Cidade</Label>
        <Select value={city} onValueChange={setCity} disabled={citiesLoading}>
          <SelectTrigger>
            <SelectValue placeholder={citiesLoading ? 'Carregando…' : 'Selecione'} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {cities?.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" loading={isLoading} disabled={!city}>
        <Search />
        Buscar
      </Button>

      {segmentId === ALL_SEGMENTS && segmentCount > 0 && (
        <p className="w-full text-[12px] text-muted-foreground">
          Busca todos os {segmentCount} segmentos de uma vez, o que consome {segmentCount} consultas
          da cota do provedor.
        </p>
      )}
    </form>
  )
}
