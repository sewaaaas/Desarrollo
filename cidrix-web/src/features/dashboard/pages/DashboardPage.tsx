import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { createDashboardApi } from '@/features/dashboard/api/dashboard.api'
import { CategoryBreakdown } from '@/features/dashboard/components/CategoryBreakdown'
import { DashboardSectionError, DashboardSectionLoading } from '@/features/dashboard/components/DashboardSectionState'
import { DashboardSummary } from '@/features/dashboard/components/DashboardSummary'
import { PeriodSelector } from '@/features/dashboard/components/PeriodSelector'
import { PriorityBreakdown } from '@/features/dashboard/components/PriorityBreakdown'
import { ResolutionMetrics } from '@/features/dashboard/components/ResolutionMetrics'
import { StatusBreakdown } from '@/features/dashboard/components/StatusBreakdown'
import { TrendsChart } from '@/features/dashboard/components/TrendsChart'
import { WorkloadPanel } from '@/features/dashboard/components/WorkloadPanel'
import type {
  DashboardOverview,
  DashboardTrends,
} from '@/features/dashboard/model/dashboard.types'
import {
  dashboardPeriodToSearchParams,
  readDashboardPeriod,
} from '@/features/dashboard/model/dashboard.utils'
import { useAuthenticatedApi } from '@/features/auth/hooks/useAuthenticatedApi'
import { Button } from '@/shared/components/Button'
import { PageContainer } from '@/shared/components/PageContainer'
import { ApiError } from '@/shared/services/api/api-error'

interface ResourceState<T> {
  data: T | null
  error: string | null
  key: string
}

function isAbortedRequest(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'aborted'
}

function dashboardErrorDescription(error: unknown, resource: 'overview' | 'trends'): string {
  if (error instanceof ApiError) {
    if (error.kind === 'network') return 'No pudimos conectar con el servidor.'
    if (error.status === 403) return 'No tienes permiso para consultar estas métricas.'
    if (error.status && error.status >= 500) return 'El servicio no está disponible temporalmente.'
  }
  return resource === 'overview'
    ? 'No se pudieron cargar las métricas.'
    : 'No se pudo cargar la tendencia.'
}

function OverviewLoading() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <DashboardSectionLoading key={item} label="Cargando resumen" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardSectionLoading label="Cargando métricas por estado" />
        <DashboardSectionLoading label="Cargando métricas por prioridad" />
      </div>
    </div>
  )
}

export function DashboardPage() {
  const authenticatedApi = useAuthenticatedApi()
  const dashboardApi = useMemo(() => createDashboardApi(authenticatedApi), [authenticatedApi])
  const [searchParams, setSearchParams] = useSearchParams()
  const period = readDashboardPeriod(searchParams)
  const rawPeriod = searchParams.get('period')
  const [overviewVersion, setOverviewVersion] = useState(0)
  const [trendsVersion, setTrendsVersion] = useState(0)
  const overviewKey = String(overviewVersion)
  const trendsKey = `${period}|${trendsVersion}`
  const [overviewState, setOverviewState] = useState<ResourceState<DashboardOverview>>({
    data: null,
    error: null,
    key: '',
  })
  const [trendsState, setTrendsState] = useState<ResourceState<DashboardTrends>>({
    data: null,
    error: null,
    key: '',
  })

  const overviewLoading = overviewState.key !== overviewKey
  const trendsLoading = trendsState.key !== trendsKey
  const overviewError = overviewLoading ? null : overviewState.error
  const trendsError = trendsLoading ? null : trendsState.error

  useEffect(() => {
    if (rawPeriod === period) return
    setSearchParams(dashboardPeriodToSearchParams(period), { replace: true })
  }, [period, rawPeriod, setSearchParams])

  useEffect(() => {
    const controller = new AbortController()

    void dashboardApi
      .getOverview(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setOverviewState({ data, error: null, key: overviewKey })
        }
      })
      .catch((error: unknown) => {
        if (isAbortedRequest(error)) return
        setOverviewState((current) => ({
          data: current.data,
          error: dashboardErrorDescription(error, 'overview'),
          key: overviewKey,
        }))
      })

    return () => controller.abort()
  }, [dashboardApi, overviewKey])

  useEffect(() => {
    const controller = new AbortController()

    void dashboardApi
      .getTrends(period, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setTrendsState({ data, error: null, key: trendsKey })
        }
      })
      .catch((error: unknown) => {
        if (isAbortedRequest(error)) return
        setTrendsState((current) => ({
          data: current.data?.period === period ? current.data : null,
          error: dashboardErrorDescription(error, 'trends'),
          key: trendsKey,
        }))
      })

    return () => controller.abort()
  }, [dashboardApi, period, trendsKey])

  function refreshDashboard() {
    if (overviewLoading || trendsLoading) return
    setOverviewVersion((current) => current + 1)
    setTrendsVersion((current) => current + 1)
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Estado general y actividad reciente de la organización.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <PeriodSelector
            onChange={(nextPeriod) => setSearchParams(dashboardPeriodToSearchParams(nextPeriod))}
            value={period}
          />
          <Button
            disabled={overviewLoading || trendsLoading}
            isLoading={(overviewLoading || trendsLoading) && Boolean(overviewState.data || trendsState.data)}
            onClick={refreshDashboard}
            variant="secondary"
          >
            Actualizar
          </Button>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {overviewLoading || trendsLoading ? 'Actualizando dashboard' : 'Dashboard actualizado'}
      </p>

      <div className="mt-6 space-y-4">
        {overviewLoading && !overviewState.data ? <OverviewLoading /> : null}
        {!overviewState.data && overviewError ? (
          <DashboardSectionError
            description={overviewError}
            onRetry={() => setOverviewVersion((current) => current + 1)}
            title="No se pudieron cargar las métricas"
          />
        ) : null}

        {overviewState.data ? (
          <>
            {overviewError ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-danger/30 bg-danger/5 p-4" role="alert">
                <p className="text-sm text-foreground">{overviewError} Se muestran los últimos datos disponibles.</p>
                <Button onClick={() => setOverviewVersion((current) => current + 1)} size="sm" variant="secondary">Reintentar</Button>
              </div>
            ) : null}
            <DashboardSummary overview={overviewState.data} />
          </>
        ) : null}

        {trendsLoading && !trendsState.data ? (
          <DashboardSectionLoading label="Cargando tendencia" />
        ) : null}
        {!trendsState.data && trendsError ? (
          <DashboardSectionError
            description={trendsError}
            onRetry={() => setTrendsVersion((current) => current + 1)}
            title="No se pudo cargar la tendencia"
          />
        ) : null}
        {trendsState.data ? (
          <>
            {trendsError ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-danger/30 bg-danger/5 p-4" role="alert">
                <p className="text-sm text-foreground">{trendsError} Se muestra la última tendencia disponible.</p>
                <Button onClick={() => setTrendsVersion((current) => current + 1)} size="sm" variant="secondary">Reintentar</Button>
              </div>
            ) : null}
            <TrendsChart trends={trendsState.data} />
          </>
        ) : null}

        {overviewState.data ? (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <StatusBreakdown counts={overviewState.data.summary.byStatus} />
              <PriorityBreakdown counts={overviewState.data.byPriority} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <CategoryBreakdown categories={overviewState.data.byCategory} />
              <ResolutionMetrics resolutionTime={overviewState.data.resolutionTime} />
            </div>
            <WorkloadPanel workload={overviewState.data.assigneeWorkload} />
          </>
        ) : null}
      </div>
    </PageContainer>
  )
}
