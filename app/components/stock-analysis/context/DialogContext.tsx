'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { EnhancedStockResult } from '../../../services/stock-selection/types'

interface DialogContextType {
  activeDialog: string | null
  dialogData: Map<string, EnhancedStockResult>
  loadingStates: Map<string, boolean>
  lastUpdated: Map<string, number>
  getDialogData: (symbol: string) => EnhancedStockResult | undefined
  setDialogData: (symbol: string, data: EnhancedStockResult) => void
  cleanupDialogData: (symbol: string) => void
  openDialog: (symbol: string) => void
  closeDialog: () => void
  canOpenDialog: () => boolean
}

const DialogContext = createContext<DialogContextType | undefined>(undefined)

interface DialogProviderProps {
  children: ReactNode
  maxConcurrentDialogs?: number
  cacheTimeout?: number
}

export const DialogProvider: React.FC<DialogProviderProps> = ({
  children,
  maxConcurrentDialogs = 3,
  cacheTimeout = 2 * 60 * 1000 // 2 minutes
}) => {
  const [activeDialog, setActiveDialog] = useState<string | null>(null)
  const [dialogData, setDialogDataMap] = useState<Map<string, EnhancedStockResult>>(new Map())
  const [loadingStates, setLoadingStatesMap] = useState<Map<string, boolean>>(new Map())
  const [lastUpdated, setLastUpdatedMap] = useState<Map<string, number>>(new Map())

  const getDialogData = useCallback((symbol: string) => {
    const data = dialogData.get(symbol)
    const timestamp = lastUpdated.get(symbol) || 0

    // Check if data is stale
    if (data && (Date.now() - timestamp) > cacheTimeout) {
      return undefined
    }

    return data
  }, [dialogData, lastUpdated, cacheTimeout])

  const setDialogData = useCallback((symbol: string, data: EnhancedStockResult) => {
    setDialogDataMap(prev => {
      const newMap = new Map(prev)
      newMap.set(symbol, data)

      // Cleanup old entries if we exceed max concurrent dialogs
      if (newMap.size > maxConcurrentDialogs) {
        const entries = Array.from(newMap.entries())
        entries.splice(0, entries.length - maxConcurrentDialogs).forEach(([key]) => {
          newMap.delete(key)
        })
      }

      return newMap
    })

    setLastUpdatedMap(prev => {
      const newMap = new Map(prev)
      newMap.set(symbol, Date.now())
      return newMap
    })
  }, [maxConcurrentDialogs])

  const cleanupDialogData = useCallback((symbol: string) => {
    setDialogDataMap(prev => {
      const newMap = new Map(prev)
      newMap.delete(symbol)
      return newMap
    })

    setLoadingStatesMap(prev => {
      const newMap = new Map(prev)
      newMap.delete(symbol)
      return newMap
    })

    setLastUpdatedMap(prev => {
      const newMap = new Map(prev)
      newMap.delete(symbol)
      return newMap
    })
  }, [])

  const openDialog = useCallback((symbol: string) => {
    setActiveDialog(symbol)
  }, [])

  const closeDialog = useCallback(() => {
    setActiveDialog(null)
  }, [])

  const canOpenDialog = useCallback(() => {
    return dialogData.size < maxConcurrentDialogs
  }, [dialogData.size, maxConcurrentDialogs])

  const contextValue: DialogContextType = {
    activeDialog,
    dialogData,
    loadingStates,
    lastUpdated,
    getDialogData,
    setDialogData,
    cleanupDialogData,
    openDialog,
    closeDialog,
    canOpenDialog
  }

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
    </DialogContext.Provider>
  )
}

export const useDialogContext = (): DialogContextType => {
  const context = useContext(DialogContext)
  if (context === undefined) {
    // Return a mock context to prevent errors
    return {
      activeDialog: null,
      dialogData: new Map(),
      loadingStates: new Map(),
      lastUpdated: new Map(),
      getDialogData: () => undefined,
      setDialogData: () => {},
      cleanupDialogData: () => {},
      openDialog: () => {},
      closeDialog: () => {},
      canOpenDialog: () => true
    }
  }
  return context
}

export default DialogContext