import { useQuery } from '@tanstack/react-query'

export interface UF {
  sigla: string
  nome: string
}

// IBGE's public territory API: the official list of states and municipalities,
// free and without a key. Called straight from the browser because it is
// reference data with no relation to the user's account — routing it through
// our own backend would only add a hop.
const IBGE = 'https://servicodados.ibge.gov.br/api/v1/localidades'

export function useStates() {
  return useQuery({
    queryKey: ['ibge', 'estados'],
    queryFn: async (): Promise<UF[]> => {
      const response = await fetch(`${IBGE}/estados?orderBy=nome`)
      if (!response.ok) throw new Error('Não foi possível carregar os estados')
      return response.json()
    },
    staleTime: Infinity,
  })
}

export function useCitiesByState(uf: string) {
  return useQuery({
    queryKey: ['ibge', 'municipios', uf],
    queryFn: async (): Promise<string[]> => {
      const response = await fetch(`${IBGE}/estados/${uf}/municipios?orderBy=nome`)
      if (!response.ok) throw new Error('Não foi possível carregar as cidades')
      const data: { nome: string }[] = await response.json()
      return data.map((c) => c.nome)
    },
    enabled: uf.length === 2,
    staleTime: Infinity,
  })
}
