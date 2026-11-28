// Mô phỏng kịch bản vận hành (Figma 26:363), tham số không hợp lệ E1 (69:2), quá thời gian E2 (69:158)
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ChevronRight, LoaderCircle } from 'lucide-react'
import { useMobilityStore } from '../../../store/useMobilityStore'
import { estimateSimulationSeconds, scopeHubCount, SIMULATION_LIMITS, validateSimulation } from '../../../store/operationSlice'
import type { SimulationParams, SimulationRun, SimulationScenarioType } from '../../../types'
import { Card, CardTitle, Checkbox, DetailRow, Notice, PageHeader, Pill, SmallLabel, inputClass } from '../../../components/shared/ui'
import { formatDate, formatTime, hubLabel, toDateInput, toTimeInput } from '../../../lib/format'
import { useNow } from '../../../lib/useNow'
import { defaultParams, formatDemand, otherScenarios, scenarioLabel, snapshotCode } from '../simulation'

const SCENARIO_CHIPS: SimulationScenarioType[] = ['DEMAND_SURGE', 'HUB_FULL', 'POWER_OUTAGE', 'CHARGER_FAULT']

// "+80%", "80", "-80 %" -> number; anything else -> NaN so validation rejects it
const parseDemand = (text: string) => /^\s*[+-]?\d+(\.\d+)?\s*%?\s*$/.test(text) ? Number(text.replace(/[%\s+]/g, '')) : Number.NaN

export default function SimulationPage() {
  const now = useNow()
  const navigate = useNavigate()
  const location = useLocation()
  const hubs = useMobilityStore((s) => s.hubs)
  const vehicles = useMobilityStore((s) => s.vehicles)
  const lastRun = useMobilityStore((s) => s.simulationRun)
  const runSimulation = useMobilityStore((s) => s.runSimulation)
  const [snapshotAt] = useState(() => new Date().toISOString())
  const [params, setParams] = useState<SimulationParams>(() => ({ ...defaultParams(), ...(location.state as { preset?: Partial<SimulationParams> } | null)?.preset }))
  const [demandText, setDemandText] = useState(() => formatDemand(params.demandChangePct))
  const [checkLimits, setCheckLimits] = useState(true)
  const [checked, setChecked] = useState<string>()
  const [running, setRunning] = useState(false)
  const [failed, setFailed] = useState<SimulationRun>()

  const effective: SimulationParams = { ...params, demandChangePct: parseDemand(demandText) }
  const error = validateSimulation(effective, hubs)
  const estimate = error ? undefined : estimateSimulationSeconds(effective, hubs)
  const timeout = failed?.status === 'TIMEOUT'
  const invalid = !!error || failed?.status === 'INVALID'
  const windowEnd = new Date(new Date(params.windowStart).getTime() + (params.durationMinutes || 0) * 60000).toISOString()
  const snapshot = snapshotCode(snapshotAt)

  const update = (change: Partial<SimulationParams>) => { setParams((current) => ({ ...current, ...change })); setFailed(undefined); setChecked(undefined) }
  const applyPreset = (scenario: SimulationScenarioType, preset: Partial<SimulationParams> = {}) => {
    update({ scenario, ...preset })
    if (preset.demandChangePct !== undefined) setDemandText(formatDemand(preset.demandChangePct))
  }
  const run = (override: Partial<SimulationParams> = {}) => {
    const next = { ...effective, ...override }
    setRunning(true)
    setFailed(undefined)
    // Short delay so the operator sees the run start; the engine itself is synchronous
    window.setTimeout(() => {
      const result = runSimulation(next)
      setRunning(false)
      if (result.status === 'COMPLETED') navigate('/operator/simulation/result')
      else setFailed(result)
    }, 900)
  }
  const retrySmaller = () => { update({ scope: 'LOCAL' }); run({ scope: 'LOCAL' }) }

  const statusTag = running ? <Pill tone="info">Đang chạy mô phỏng…</Pill>
    : timeout ? <Pill tone="danger">Thất bại · quá {SIMULATION_LIMITS.maxSeconds} giây</Pill>
      : invalid ? <Pill tone="danger">Tham số không hợp lệ</Pill>
        : <Pill tone="info">Chưa chạy mô phỏng</Pill>

  return <div className="space-y-6">
    <PageHeader now={now} clockSuffix="Làm mới mỗi 5s" eyebrow="Mô phỏng / What-if simulation"
      title={timeout ? 'Mô phỏng không hoàn thành' : 'Mô phỏng kịch bản vận hành'}
      subtitle={timeout ? `Phiên mô phỏng vượt giới hạn ${SIMULATION_LIMITS.maxSeconds} giây. Snapshot ${snapshot} vẫn được giữ nguyên, dữ liệu thực không bị ảnh hưởng.`
        : invalid ? 'Tham số kịch bản chưa hợp lệ. Hệ thống chưa chạy mô phỏng và dữ liệu vận hành thực không bị ảnh hưởng.'
          : 'Thử nghiệm kịch bản giả định và đánh giá tác động trước khi áp dụng ngoài thực tế.'} />

    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#edf4fa] px-5 py-4">
      <div><p className="text-xs font-semibold uppercase text-[#2b5f8e]">Snapshot độc lập · {snapshot}</p>
        <p className="mt-1 text-sm text-[#17332f]">Ảnh chụp trạng thái lúc {formatTime(snapshotAt)} · {hubs.length} Hub · {vehicles.length} xe. Mô phỏng không làm thay đổi trạng thái vận hành thực.</p></div>
      <span className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-[#2b5f8e]">Đã sẵn sàng</span>
    </div>

    {lastRun?.status === 'COMPLETED' && !failed && <Notice tone="info" title={`Đã có kết quả ${lastRun.runId} lúc ${formatTime(lastRun.snapshotAt)}`}>
      <Link to="/operator/simulation/result" className="font-semibold underline">Xem kết quả và khuyến nghị</Link>
    </Notice>}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_464px]">
      <Card className="min-w-0">
        <CardTitle title="Cấu hình kịch bản" subtitle="Chọn tình huống, phạm vi ảnh hưởng và các tham số để chạy mô phỏng." />
        <div className="space-y-5">
          <div>
            <label htmlFor="sim-scenario" className="mb-2 block text-xs text-[#5f716c]">Loại kịch bản</label>
            <select id="sim-scenario" value={params.scenario} onChange={(event) => applyPreset(event.target.value as SimulationScenarioType)} className={inputClass}>
              {(Object.keys(scenarioLabel) as SimulationScenarioType[]).map((scenario) => <option key={scenario} value={scenario}>{scenarioLabel[scenario]}</option>)}
            </select>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">{SCENARIO_CHIPS.map((scenario) => <button key={scenario} type="button" onClick={() => applyPreset(scenario)}
              className={`rounded-lg border px-3 py-3 text-left text-xs ${params.scenario === scenario ? 'border-[#087f6a] bg-[#e6f4ef] font-semibold text-[#087f6a]' : 'border-[#e4ece9] bg-[#f4f7f6] text-[#17332f] hover:bg-[#eaf0ee]'}`}>{scenarioLabel[scenario]}</button>)}</div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-[#5f716c]">Hub bị ảnh hưởng<select value={params.hubId} onChange={(event) => update({ hubId: event.target.value })} className={`${inputClass} mt-2`}>{hubs.map((hub) => <option key={hub.hubId} value={hub.hubId}>{hubLabel(hub)}</option>)}</select></label>
            <label className="text-xs text-[#5f716c]">Phạm vi mô phỏng<select value={params.scope} onChange={(event) => update({ scope: event.target.value as SimulationParams['scope'] })} className={`${inputClass} mt-2`}>
              <option value="NETWORK">{hubs.length} Hub · Toàn mạng lưới</option><option value="LOCAL">{scopeHubCount({ scope: 'LOCAL' }, hubs)} Hub · Khu vực gần Hub trọng tâm</option></select></label>
            <label className="text-xs text-[#5f716c]">Mức tăng nhu cầu<input value={demandText} onChange={(event) => { setDemandText(event.target.value); setFailed(undefined); setChecked(undefined) }}
              aria-invalid={Number.isNaN(parseDemand(demandText)) || !!error?.startsWith('Mức tăng')} className={`${inputClass} mt-2 ${error?.startsWith('Mức tăng') ? '!border-[#b42318]' : ''}`} /></label>
            <label className="text-xs text-[#5f716c]">Thời gian giả lập (phút)<input type="number" min={SIMULATION_LIMITS.minDuration} max={SIMULATION_LIMITS.maxDuration} value={params.durationMinutes}
              onChange={(event) => update({ durationMinutes: Number(event.target.value) })} className={`${inputClass} mt-2 ${error?.startsWith('Thời gian') ? '!border-[#b42318]' : ''}`} /></label>
          </div>
          <label className="block text-xs text-[#5f716c]">Khung giờ giả lập · {formatTime(params.windowStart)} – {formatTime(windowEnd)} · {formatDate(params.windowStart)}
            <input type="time" value={toTimeInput(new Date(params.windowStart))} onChange={(event) => { const value = new Date(`${toDateInput(new Date(params.windowStart))}T${event.target.value}`); if (!Number.isNaN(value.getTime())) update({ windowStart: value.toISOString() }) }} className={`${inputClass} mt-2`} /></label>
          <label className="block text-xs text-[#5f716c]">Lượt xe bổ sung (lượt thuê hoặc trả thêm tại Hub trọng tâm)
            <input type="number" min={0} value={params.extraTrips} onChange={(event) => update({ extraTrips: Number(event.target.value) })} className={`${inputClass} mt-2`} /></label>

          <div className="space-y-4">
            <SmallLabel>Tùy chọn & kiểm tra</SmallLabel>
            <Checkbox id="sim-snapshot" checked onChange={() => undefined} label={`Dùng ảnh chụp độc lập ${snapshot}`} hint="Không ghi đè dữ liệu vận hành thực; các thay đổi chỉ tồn tại trong phiên mô phỏng." />
            <Checkbox id="sim-limits" checked={checkLimits} onChange={setCheckLimits} label="Kiểm tra giới hạn sức chứa và tham số trước khi chạy" />
          </div>

          {timeout ? <div role="alert" className="rounded-xl bg-[#fde8e6] p-4 text-sm text-[#b42318]"><p className="font-semibold">Mô phỏng thất bại · quá {SIMULATION_LIMITS.maxSeconds} giây</p><p className="mt-1">{failed?.error} (ước tính {failed?.estimatedSeconds} giây)</p></div>
            : error || failed?.error ? <div role="alert" className="rounded-xl bg-[#fde8e6] p-4 text-sm text-[#b42318]"><p className="font-semibold">Tham số không hợp lệ</p><p className="mt-1">{error ?? failed?.error}</p></div>
              : checked ? <Notice tone="success" title={checked} />
                : <div className="rounded-xl bg-[#fff4df] p-4 text-sm text-[#946013]"><p className="font-semibold">Lưu ý giới hạn mô phỏng</p><p className="mt-1">Giá trị âm hoặc vượt sức chứa thiết kế sẽ bị từ chối (mức tăng {SIMULATION_LIMITS.minDemandPct}–{SIMULATION_LIMITS.maxDemandPct}%, {SIMULATION_LIMITS.minDuration}–{SIMULATION_LIMITS.maxDuration} phút). Quy mô tối đa của phiên là {hubs.length} Hub.</p></div>}

          <div className="border-t border-[#e4ece9] pt-4 text-xs text-[#5f716c]">Thời gian hoàn thành mục tiêu: ≤ {SIMULATION_LIMITS.maxSeconds} giây{estimate !== undefined && ` · ước tính ${estimate} giây`}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setChecked(error ? undefined : `Tham số hợp lệ · ước tính ${estimate} giây${estimate! > SIMULATION_LIMITS.maxSeconds ? ' (vượt giới hạn, nên thu hẹp phạm vi)' : ''}`)}
              className="rounded-lg border border-[#d7e2de] bg-white px-4 py-3 text-left text-sm font-semibold text-[#087f6a] hover:bg-[#f4f7f6]">Kiểm tra tham số</button>
            {timeout
              ? <button type="button" disabled={running} onClick={retrySmaller} className="rounded-lg bg-[#087f6a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#066b59] disabled:bg-[#9cc8bd]">Chạy lại với quy mô nhỏ hơn</button>
              : <button type="button" disabled={running || (checkLimits && !!error)} onClick={() => run()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#087f6a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#066b59] disabled:cursor-not-allowed disabled:bg-[#9cc8bd]">{running && <LoaderCircle size={16} className="animate-spin" />}{running ? 'Đang chạy…' : 'Chạy mô phỏng'}</button>}
          </div>
          <p className="text-xs text-[#5f716c]">{timeout ? 'Điều chỉnh phạm vi hoặc thời gian rồi chạy lại.' : checkLimits && error ? 'Nút chạy bị khóa cho đến khi tham số hợp lệ.' : 'Sau khi hoàn tất, xem kết quả tác động và khuyến nghị ở màn hình tiếp theo.'}</p>
        </div>
      </Card>

      <aside className="min-w-0 space-y-6">
        <Card>
          <CardTitle title="Tóm tắt kịch bản" subtitle="Thông số đang được thiết lập" />
          <DetailRow label="Loại kịch bản" value={scenarioLabel[params.scenario]} />
          <DetailRow label="Hub trọng tâm" value={hubLabel(hubs.find((hub) => hub.hubId === params.hubId))} />
          <DetailRow label="Mức tăng nhu cầu" value={<span className={error?.startsWith('Mức tăng') ? 'text-[#b42318]' : ''}>{demandText || '—'}</span>} />
          <DetailRow label="Thời gian" value={`${params.durationMinutes || '—'} phút`} />
          <DetailRow label="Phạm vi" value={`${scopeHubCount(params, hubs)} Hub`} />
          <DetailRow label="Snapshot" value={`${snapshot} · ${formatTime(snapshotAt)}`} />
          <div className="mt-3">{statusTag}</div>
        </Card>
        <Card>
          <CardTitle title="Sau khi chạy mô phỏng" subtitle="Màn hình kết quả sẽ hiển thị" />
          <ol className="space-y-4">{[['Đánh giá tác động', 'Số xe, chỗ đỗ và cổng sạc sau nhu cầu'], ['So sánh trước / sau', 'Trạng thái từng Hub trong snapshot'], ['Khuyến nghị điều phối', 'Điều chuyển xe, đổi lịch sạc hoặc hướng Hub']].map(([title, text], index) =>
            <li key={title} className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#e6f4ef] text-xs font-semibold text-[#087f6a]">0{index + 1}</span><span><span className="block text-sm font-semibold text-[#17332f]">{title}</span><span className="text-xs text-[#5f716c]">{text}</span></span></li>)}</ol>
        </Card>
        <Card>
          <CardTitle title="Kịch bản khác" subtitle="Chọn nhanh một tình huống để thay đổi tham số" />
          <div className="space-y-2">{otherScenarios.map((item) => <button key={item.scenario} type="button" onClick={() => applyPreset(item.scenario, item.preset)}
            className="flex w-full items-center justify-between gap-3 rounded-lg bg-[#f4f7f6] px-4 py-3 text-left hover:bg-[#eaf0ee]">
            <span><span className="block text-sm font-semibold text-[#17332f]">{item.title}</span><span className="text-xs text-[#5f716c]">{item.text}</span></span><ChevronRight size={16} className="text-[#5f716c]" />
          </button>)}</div>
        </Card>
      </aside>
    </div>
  </div>
}
