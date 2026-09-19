import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardList, CheckBox, Chevron } from '@/components/Card/Card'
import { CATEGORY_ICON, CATEGORY_IDS, CATEGORY_TONE, toneOf } from '@/components/categories'
import { CropIcon } from '@/components/CropIcon/CropIcon'
import { IconGrid } from '@/components/IconGrid/IconGrid'
import { InfoBar } from '@/components/InfoBar/InfoBar'
import { KeyCap } from '@/components/KeyCap/KeyCap'
import { MetricGrid } from '@/components/MetricGrid/MetricGrid'
import { NewsCard } from '@/components/NewsCard/NewsCard'
import { Pill } from '@/components/Pill/Pill'
import { PriceTypeTag } from '@/components/PriceTypeTag/PriceTypeTag'
import { UpIsPosContext } from '@/components/rise'
import { Sheet } from '@/components/Sheet/Sheet'
import { Shell } from '@/components/Shell/Shell'
import { Skeleton } from '@/components/Skeleton/Skeleton'
import { Sparkline } from '@/components/Sparkline/Sparkline'
import { StatusBox } from '@/components/StatusBox/StatusBox'
import { Tabs } from '@/components/Tabs/Tabs'
import { Tile } from '@/components/Tile/Tile'
import { TrendChart, type TrendPoint } from '@/components/TrendChart/TrendChart'
import { dateLabels, pickText, type LocalizedText } from '@/i18n'
import { CropSvg } from '@/icons/crops'
import { CROP_ICON_IDS, UI_ICON_NAMES } from '@/icons/names'
import { Logo, UiIcon } from '@/icons/ui'
import { directionOf, formatPercent } from '@/lib/change'
import { formatDate } from '@/lib/dates'
import { formatPrice } from '@/lib/format'
import { UNITS } from '@/lib/units'
import { useKeys } from '@/keys/useKeys'

import styles from './DebugComponents.module.css'

// Sample data only: this page shows every component in its main states at both screen sizes
// (T24 checks it with Playwright). Prices are per kg, as the API sends them.

const INDIA = { locale: 'en-IN', unit: UNITS.qtl, unitLabel: { 'zh-TW': '₹/公擔', en: '₹/qtl' } }
const TAIWAN = { locale: 'zh-TW', unit: UNITS.kg, unitLabel: { 'zh-TW': '元/公斤', en: 'NT$/kg' } }
const AREA: LocalizedText = { 'zh-TW': 'Nashik 縣', en: 'Nashik' }
const TODAY = '2026-09-19'

interface SampleCrop {
  id: string
  category: string
  name: LocalizedText
  variety: LocalizedText
  /** Latest price per kg; `null` when there is none. */
  price: number | null
  change: number | null
  week: (number | null)[]
}

const CROPS: SampleCrop[] = [
  {
    id: 'onion',
    category: 'veg',
    name: { 'zh-TW': '洋蔥', en: 'Onion' },
    variety: { 'zh-TW': '紅洋蔥', en: 'Red' },
    price: 23.5,
    change: 0.042,
    week: [21.9, 22.4, 22.1, 22.8, 22.6, 22.55, 23.5],
  },
  {
    id: 'tomato',
    category: 'veg',
    name: { 'zh-TW': '番茄', en: 'Tomato' },
    variety: { 'zh-TW': '雜交種', en: 'Hybrid' },
    price: 11.8,
    change: -0.12,
    week: [13.9, 13.6, null, 13.1, 13.4, 13.41, 11.8],
  },
  {
    id: 'potato',
    category: 'veg',
    name: { 'zh-TW': '馬鈴薯', en: 'Potato' },
    variety: { 'zh-TW': '本地種', en: 'Local' },
    price: 14.2,
    change: 0,
    week: [14.1, 14.3, 14.2, 14.2, 14.1, 14.2, 14.2],
  },
  {
    id: 'chilli',
    category: 'spice',
    name: { 'zh-TW': '青辣椒（本地長種特選）', en: 'Green chilli, long local variety' },
    variety: { 'zh-TW': '本地種', en: 'Local' },
    price: null,
    change: null,
    week: [],
  },
]

/** 30 days up to today, with a gap every Sunday and two missing reports. */
const MONTH_VALUES = Array.from({ length: 30 }, (_, i) =>
  i % 7 === 2 || i === 17 || i === 18 ? null : 22 + 2.4 * Math.sin(i / 4) + (i % 3) * 0.3,
)
const WEEK_VALUES = [22.1, 22.8, null, 22.6, 22.55, 23.1, 23.5]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{title}</h2>
      {children}
    </section>
  )
}

/** Every component from src/components in its main states (dev and demo builds only). */
export default function DebugComponents() {
  const { t, i18n } = useTranslation()
  const zh = i18n.language.startsWith('zh')
  const text = (value: LocalizedText) => pickText(value, i18n.language)
  const labels = dateLabels(t)
  const inPrice = (perKg: number | null) => formatPrice(perKg, INDIA.unit, INDIA.locale)
  const percent = (ratio: number) => formatPercent(ratio, INDIA.locale)
  const area = text(AREA)

  const page = useRef<HTMLDivElement>(null)
  const move = (step: number) => {
    const items = Array.from(page.current?.querySelectorAll<HTMLElement>('[data-focus-id]') ?? [])
    const at = items.findIndex((item) => item === document.activeElement)
    items[Math.min(items.length - 1, Math.max(0, at + step))]?.focus()
  }
  useKeys({ onUp: () => move(-1), onDown: () => move(1) })
  // Start on the first card so the focus style shows without pressing a key.
  useEffect(() => {
    page.current?.querySelector<HTMLElement>('[data-focus-id]')?.focus()
  }, [])

  const week: TrendPoint[] = WEEK_VALUES.map((value, day) => ({
    value,
    label: labels.weekdayInitials[day] ?? '',
  }))
  const month: TrendPoint[] = MONTH_VALUES.map((value, i) => {
    const date = new Date(Date.UTC(2026, 7, 21 + i))
    const [m, d] = [date.getUTCMonth() + 1, date.getUTCDate()]
    return { value, label: zh ? `${m}/${d}` : `${d}/${m}` }
  })
  const chart = {
    tone: toneOf('veg'),
    formatValue: inPrice,
    closedLabel: t('detail.trend.closedShort'),
  }

  const cropCard = (crop: SampleCrop, index: number, locale = INDIA) => {
    const direction = directionOf(crop.change)
    return (
      <Card
        key={crop.id}
        focusId={`crop:${crop.id}`}
        lead={<CropIcon crop={crop.id} category={crop.category} keyCap={index + 1} />}
        name={text(crop.name)}
        meta={crop.price === null ? t('freshness.none') : text(crop.variety)}
        spark={direction && <Sparkline values={crop.week} direction={direction} />}
        price={crop.price === null ? null : formatPrice(crop.price, locale.unit, locale.locale)}
        pill={
          direction && crop.change !== null
            ? { kind: direction, text: formatPercent(crop.change, locale.locale) }
            : undefined
        }
      />
    )
  }

  const pills = (
    <>
      <Pill kind="up" text={percent(0.042)} />
      <Pill kind="down" text={percent(-0.12)} />
      <Pill kind="flat" text={percent(0)} />
      <Pill kind="old" text={t('freshness.old')} />
      <Pill kind="you" text={t('detail.compare.you')} />
    </>
  )

  return (
    <Shell
      title="Debug: components"
      titleAddon={<KeyCap>#</KeyCap>}
      softKeys={{ left: t('softkeys.menu'), center: t('softkeys.open'), right: t('softkeys.back') }}
    >
      <div ref={page} className={styles.page}>
        <InfoBar
          left={
            <>
              <KeyCap>*</KeyCap>
              <PriceTypeTag type="wholesale" label={t('priceType.wholesale')} />
              {text(INDIA.unitLabel)}
            </>
          }
          right={
            <>
              <UiIcon name="cal" />
              {formatDate(TODAY, labels)}
            </>
          }
        />
        <InfoBar
          left={
            <>
              <UiIcon name="pin" />
              <b>{area}</b>
              <KeyCap>#</KeyCap>
            </>
          }
          right={
            <>
              <KeyCap>*</KeyCap>
              <PriceTypeTag type="retail" label={t('priceType.retail')} />
              <span className={styles.warn}>{t('freshness.daysAgo', { n: 3 })}</span>
            </>
          }
        />
        <Tabs
          tabs={[
            { id: 'watch', label: t('home.tabs.watch') },
            { id: 'all', label: t('home.tabs.all') },
          ]}
          activeId="watch"
        />
        <Tabs
          tabs={[
            { id: 'trend', label: t('detail.tabs.trend') },
            { id: 'today', label: t('detail.tabs.today') },
            { id: 'compare', label: t('detail.tabs.compare') },
          ]}
          activeId="today"
        />

        <Section title="Cards">
          <CardList>
            {CROPS.map((crop, i) => cropCard(crop, i))}
            <Card
              name={text({ 'zh-TW': '大蒜', en: 'Garlic' })}
              lead={<CropIcon crop="garlic" category="spice" />}
              spark={<Sparkline values={[]} direction="flat" />}
              loading
            />
            <Card
              focusId="error"
              variant="alert"
              lead={
                <Tile>
                  <UiIcon name="alert" />
                </Tile>
              }
              name={t('states.error')}
              meta={t('states.showingOld', { time: '09:12' })}
              price={inPrice(22.1)}
              pill={{ kind: 'old', text: t('freshness.old') }}
            />
            <Card
              focusId="area:nashik"
              variant="mine"
              lead={<Tile round>3</Tile>}
              name={area}
              meta={t('detail.compare.marketCount', { count: 3 })}
              price={inPrice(23.5)}
              pill={{ kind: 'you', text: t('detail.compare.you') }}
            />
            <Card
              focusId="markets"
              lead={
                <Tile>
                  <UiIcon name="store" />
                </Tile>
              }
              name={t('detail.today.markets', { count: 4 })}
              meta={t('detail.today.marketsRange', { high: inPrice(24.1), low: inPrice(22.9) })}
              trailing={<Chevron okKey />}
            />
            <Card
              focusId="watch:onion"
              lead={<CropIcon crop="onion" category="veg" />}
              name={text(CROPS[0]?.name ?? {})}
              meta={text(CROPS[0]?.variety ?? {})}
              trailing={<CheckBox checked />}
            />
            <Card
              focusId="watch:tomato"
              lead={<CropIcon crop="tomato" category="veg" />}
              name={text(CROPS[1]?.name ?? {})}
              trailing={<CheckBox checked={false} />}
            />
            <Card
              focusId="settings:language"
              compact
              lead={
                <Tile keyCap={1}>
                  <UiIcon name="globe" />
                </Tile>
              }
              name={t('settings.rows.language')}
              trailing={zh ? '繁體中文' : 'English'}
            />
            <Card
              focusId="trend"
              lead={
                <Tile>
                  <UiIcon name="trend" />
                </Tile>
              }
              name={t('states.seeTrend')}
              trailing={<Chevron />}
            />
          </CardList>
        </Section>

        <Section title="News cards">
          <CardList>
            <NewsCard
              focusId="news:sample"
              keyCap={1}
              title="連日豪雨重創中南部產區 葉菜類價格一週內上漲三成，市場預估兩週後才會逐步回穩"
              titleLang="zh-TW"
              summary="中南部連日豪雨，葉菜類產區受損，批發價一週內上漲約三成。市場預估要兩週後新的葉菜上市，價格才會回穩。"
              summaryLang="zh-TW"
              meta={`${text({ 'zh-TW': '小白菜', en: 'Bok choy' })} · ${t('news.today')}`}
              source="公視新聞網PNN"
            />
            <NewsCard
              keyCap={2}
              title="Government buffer sales keep potato prices steady across India"
              titleLang="en"
              meta={`${text({ 'zh-TW': '馬鈴薯', en: 'Potato' })} · ${labels.yesterday}`}
              source="The Economic Times"
            />
          </CardList>
        </Section>

        <Section title="Cards · TW colours">
          <UpIsPosContext value={false}>
            <CardList>{CROPS.slice(0, 2).map((crop, i) => cropCard(crop, i, TAIWAN))}</CardList>
          </UpIsPosContext>
        </Section>

        <Section title="Pills · IN (rise green)">
          <div className={styles.row}>{pills}</div>
        </Section>
        <Section title="Pills · TW (rise red)">
          <UpIsPosContext value={false}>
            <div className={styles.row}>{pills}</div>
          </UpIsPosContext>
        </Section>

        <Section title="Tags and key caps">
          <div className={styles.row}>
            <PriceTypeTag type="wholesale" label={t('priceType.wholesale')} />
            <PriceTypeTag type="retail" label={t('priceType.retail')} />
            {['1', '9', '0', '*', '#', 'OK'].map((key) => (
              <KeyCap key={key}>{key}</KeyCap>
            ))}
          </div>
        </Section>

        <Section title="Sparklines">
          <div className={styles.row}>
            <Sparkline values={[3, 4, 3.5, 5, 6]} direction="up" />
            <Sparkline values={[6, 5, 5.5, 4, 3]} direction="down" />
            <Sparkline values={[4, 4, 4, 4]} direction="flat" />
            <Sparkline values={[3, null, 5, 4, null, 6]} direction="up" />
            <Sparkline values={[null, 5]} direction="flat" />
          </div>
        </Section>

        <Section title="Trend · 7 days">
          <div className={styles.box}>
            <TrendChart points={week} {...chart} />
          </div>
        </Section>
        <Section title="Trend · 30 days">
          <div className={styles.box}>
            <TrendChart points={month} {...chart} />
          </div>
        </Section>

        <Section title="Metrics">
          <div className={styles.pad}>
            <MetricGrid
              tone={toneOf('veg')}
              items={[
                { label: t('detail.stats.vsAvg7'), value: '+3.1%', direction: 'up' },
                {
                  label: t('detail.stats.arrivals.label'),
                  value: `${t('detail.stats.arrivals.high')} ▲18%`,
                },
                {
                  label: t('detail.stats.position30.label'),
                  value: `${t('detail.stats.position30.high')} 72%`,
                  gauge: 0.72,
                },
              ]}
            />
          </div>
        </Section>

        <Section title="Category grid">
          <IconGrid
            items={CATEGORY_IDS.map((id, i) => ({
              focusId: `cat:${id}`,
              label: t(`categories.${id}`),
              icon: CATEGORY_ICON[id],
              tone: CATEGORY_TONE[id],
              keyCap: i + 1,
            }))}
          />
        </Section>

        <Section title="Status boxes">
          <StatusBox icon="alert" title={t('states.error')} lines={[t('states.settingsKept')]} />
          <StatusBox
            icon="store"
            title={t('states.notUpdated', { area })}
            details={[
              t('states.usualUpdate', { time: '14:00' }),
              t('states.lastPrice', {
                when: t('freshness.daysAgo', { n: 3 }),
                price: inPrice(24.4),
              }),
            ]}
          />
          <StatusBox lines={[t('states.loading', { area }), t('states.loadingNote')]} />
        </Section>

        <Section title="Skeletons">
          <div className={styles.stack}>
            <Skeleton />
            <Skeleton width="60%" />
            <Skeleton width={38} />
          </div>
        </Section>

        <Section title="Sheet (open)">
          <div className={styles.frame}>
            <Sheet
              title={t('detail.compare.sortTitle')}
              items={(['priceDesc', 'priceAsc', 'distanceAsc', 'distanceDesc'] as const).map(
                (id) => ({
                  focusId: `sort:${id}`,
                  label: t(`detail.compare.sorts.${id}`),
                  icon: 'sort',
                  current: id === 'priceDesc',
                }),
              )}
            />
          </div>
        </Section>

        <Section title="Icons">
          <div className={styles.row}>
            {CROP_ICON_IDS.map((id) => (
              <Tile key={id} art>
                <CropSvg id={id} />
              </Tile>
            ))}
          </div>
          <div className={styles.row}>
            {UI_ICON_NAMES.map((name) => (
              <Tile key={name}>
                <UiIcon name={name} />
              </Tile>
            ))}
            <Logo className={styles.logo} />
          </div>
        </Section>
      </div>
    </Shell>
  )
}
