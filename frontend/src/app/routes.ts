/**
 * The whole route table, registered at once (docs/04 §4.3). Each screen lives in its own file
 * under src/screens/, so screen tasks only touch their own files.
 */
import { type ComponentType, createElement } from 'react'
import { Navigate, type RouteObject } from 'react-router'

import AboutScreen from '@/screens/about/AboutScreen'
import AreasScreen from '@/screens/areas/AreasScreen'
import CropDetailScreen from '@/screens/crop-detail/CropDetailScreen'
import CropListScreen from '@/screens/crop-list/CropListScreen'
import HomeScreen from '@/screens/home/HomeScreen'
import IntlScreen from '@/screens/intl/IntlScreen'
import IntlSeriesScreen from '@/screens/intl/IntlSeriesScreen'
import MarketScreen from '@/screens/markets/MarketScreen'
import MarketsScreen from '@/screens/markets/MarketsScreen'
import NewsDetailScreen from '@/screens/news/NewsDetailScreen'
import NewsListScreen from '@/screens/news/NewsListScreen'
import SettingsItemScreen from '@/screens/settings/SettingsItemScreen'
import SettingsScreen from '@/screens/settings/SettingsScreen'
import CountryScreen from '@/screens/setup/CountryScreen'
import LanguageScreen from '@/screens/setup/LanguageScreen'
import LocateScreen from '@/screens/setup/LocateScreen'
import MoreLanguagesScreen from '@/screens/setup/MoreLanguagesScreen'
import SetupAreaScreen from '@/screens/setup/SetupAreaScreen'
import WatchScreen from '@/screens/watch/WatchScreen'

import { debugRoutes } from './debugRoutes'
import { DetailTabGuard } from './DetailTabGuard'
import { RootLayout } from './RootLayout'
import { ScreenError } from './ScreenError'

export const SCREEN_NAMES = [
  'home',
  'crop-list',
  'crop-detail',
  'markets',
  'market',
  'areas',
  'watch',
  'settings',
  'settings-item',
  'about',
  'intl',
  'intl-series',
  'news',
  'news-item',
  'setup-lang',
  'setup-langs',
  'setup-locate',
  'setup-country',
  'setup-area',
] as const
export type ScreenName = (typeof SCREEN_NAMES)[number]
export type ScreenMap = Record<ScreenName, ComponentType>

export const SCREENS: ScreenMap = {
  home: HomeScreen,
  'crop-list': CropListScreen,
  'crop-detail': CropDetailScreen,
  markets: MarketsScreen,
  market: MarketScreen,
  areas: AreasScreen,
  watch: WatchScreen,
  settings: SettingsScreen,
  'settings-item': SettingsItemScreen,
  about: AboutScreen,
  intl: IntlScreen,
  'intl-series': IntlSeriesScreen,
  news: NewsListScreen,
  'news-item': NewsDetailScreen,
  'setup-lang': LanguageScreen,
  'setup-langs': MoreLanguagesScreen,
  'setup-locate': LocateScreen,
  'setup-country': CountryScreen,
  'setup-area': SetupAreaScreen,
}

export function buildRoutes(screens: ScreenMap): RouteObject[] {
  const children: RouteObject[] = [
    { index: true, Component: screens.home },
    { path: 'cat/:catId', Component: screens['crop-list'] },
    { path: 'crop/:cropId/markets', Component: screens.markets },
    { path: 'crop/:cropId/markets/:marketId', Component: screens.market },
    {
      path: 'crop/:cropId/:tab',
      element: createElement(DetailTabGuard, { screen: screens['crop-detail'] }),
    },
    { path: 'areas', Component: screens.areas },
    { path: 'watch', Component: screens.watch },
    { path: 'settings', Component: screens.settings },
    { path: 'settings/:item', Component: screens['settings-item'] },
    { path: 'about', Component: screens.about },
    { path: 'intl', Component: screens.intl },
    { path: 'intl/:seriesId', Component: screens['intl-series'] },
    { path: 'news', Component: screens.news },
    { path: 'news/:newsId', Component: screens['news-item'] },
    { path: 'setup/lang', Component: screens['setup-lang'] },
    { path: 'setup/langs', Component: screens['setup-langs'] },
    { path: 'setup/locate', Component: screens['setup-locate'] },
    { path: 'setup/country', Component: screens['setup-country'] },
    { path: 'setup/area', Component: screens['setup-area'] },
    ...debugRoutes,
    { path: '*', element: createElement(Navigate, { to: '/', replace: true }) },
  ]
  // Every screen gets its own error boundary (docs/04 §8).
  return [
    {
      Component: RootLayout,
      ErrorBoundary: ScreenError,
      children: children.map((route) => ({ ...route, ErrorBoundary: ScreenError })),
    },
  ]
}

export const appRoutes = buildRoutes(SCREENS)
