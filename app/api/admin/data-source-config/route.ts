import { NextRequest, NextResponse } from 'next/server'
import { EnhancedDataService } from '../../../services/financial-data/EnhancedDataService'
import { DataSourceProvider } from '../../../services/financial-data/DataSourceManager'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, configType, dataType, primary } = body

    const enhancedService = new EnhancedDataService()

    switch (action) {
      case 'quick-config':
        switch (configType) {
          case 'free':
            enhancedService.configureForFreeTier()
            break
          case 'development':
            enhancedService.configureForDevelopment()
            break
          case 'premium':
            enhancedService.configureForPremium()
            break
          default:
            return NextResponse.json({
              success: false,
              error: 'Invalid config type'
            }, { status: 400 })
        }
        break

      case 'set-preference':
        if (!dataType || !primary) {
          return NextResponse.json({
            success: false,
            error: 'Missing dataType or primary provider'
          }, { status: 400 })
        }

        // Get current preferences to maintain fallbacks
        const currentPreferences = enhancedService.getDataSourcePreferences()
        const currentPreference: { fallbacks: string[] } | undefined = (currentPreferences as Record<string, any>)[dataType]

        if (currentPreference) {
          // Keep existing fallbacks, just change primary
          const fallbacks: DataSourceProvider[] = currentPreference.fallbacks.filter((f: string) => f !== primary) as DataSourceProvider[]
          enhancedService.setDataSourcePreference(dataType, primary as DataSourceProvider, fallbacks)
        } else {
          // New preference, use default fallbacks based on provider configs
          const providerConfigs = enhancedService.getProviderConfigs()
          const defaultFallbacks: DataSourceProvider[] = Object.entries(providerConfigs)
            .filter(([provider, config]: [string, any]) =>
              provider !== primary &&
              config.enabled &&
              config.supportedDataTypes.includes(dataType)
            )
            .sort((a: [string, any], b: [string, any]) => b[1].priority - a[1].priority)
            .slice(0, 2)
            .map(([provider]: [string, any]) => provider as DataSourceProvider)

          enhancedService.setDataSourcePreference(dataType, primary as DataSourceProvider, defaultFallbacks)
        }
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully'
    })

  } catch (error) {
    console.error('Error updating data source configuration:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}