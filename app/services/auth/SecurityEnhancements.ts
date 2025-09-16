/**
 * Security Enhancements for Financial Authentication System
 * Additional security layers and monitoring capabilities
 */

import crypto from 'crypto'
import { User, SecurityEvent } from './types'
import { redisCache } from '../cache/RedisCache'

/**
 * Advanced threat detection and prevention
 */
export class ThreatDetection {
  private static suspiciousPatterns = new Map<string, number>()
  private static blockedIPs = new Set<string>()

  /**
   * Detect suspicious login patterns
   */
  static async analyzeSuspiciousActivity(
    identifier: string,
    clientInfo: {
      ipAddress: string
      userAgent: string
      deviceFingerprint?: string
    }
  ): Promise<{ isSuspicious: boolean; riskScore: number; reasons: string[] }> {
    const riskFactors: string[] = []
    let riskScore = 0

    // Check for rapid login attempts from different locations
    const recentLogins = await redisCache.get(`login_attempts:${identifier}`) || []
    if (recentLogins.length > 5) {
      riskScore += 30
      riskFactors.push('Multiple rapid login attempts')
    }

    // Check for known malicious IP ranges
    if (this.isKnownThreatIP(clientInfo.ipAddress)) {
      riskScore += 50
      riskFactors.push('IP address in threat database')
    }

    // Check for suspicious user agent patterns
    if (this.isSuspiciousUserAgent(clientInfo.userAgent)) {
      riskScore += 20
      riskFactors.push('Suspicious user agent detected')
    }

    // Check for device fingerprint changes
    if (clientInfo.deviceFingerprint) {
      const storedFingerprint = await redisCache.get(`device:${identifier}`)
      if (storedFingerprint && storedFingerprint !== clientInfo.deviceFingerprint) {
        riskScore += 25
        riskFactors.push('Device fingerprint mismatch')
      }
    }

    return {
      isSuspicious: riskScore >= 50,
      riskScore,
      reasons: riskFactors
    }
  }

  /**
   * Check if IP is in threat database
   */
  private static isKnownThreatIP(ipAddress: string): boolean {
    // In production, this would check against threat intelligence feeds
    const threatRanges = [
      '10.0.0.0/8',    // Example blocked ranges
      '192.168.0.0/16'
    ]
    return this.blockedIPs.has(ipAddress)
  }

  /**
   * Detect suspicious user agent patterns
   */
  private static isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /scanner/i,
      /hack/i,
      /attack/i
    ]
    return suspiciousPatterns.some(pattern => pattern.test(userAgent))
  }

  /**
   * Implement IP blocking
   */
  static async blockIP(ipAddress: string, duration: number = 3600): Promise<void> {
    this.blockedIPs.add(ipAddress)
    await redisCache.set(`blocked_ip:${ipAddress}`, true, duration)
    console.log(`🚫 IP ${ipAddress} blocked for ${duration} seconds`)
  }
}

/**
 * Enhanced audit logging for compliance
 */
export class ComplianceLogger {
  /**
   * Log security event with comprehensive metadata
   */
  static async logSecurityEvent(
    eventType: string,
    userId: string | undefined,
    metadata: {
      ipAddress: string
      userAgent: string
      sessionId?: string
      riskScore?: number
      threatIndicators?: string[]
      dataAccessed?: string[]
      actionTaken?: string
    }
  ): Promise<void> {
    const securityEvent: SecurityEvent = {
      id: crypto.randomUUID(),
      userId,
      sessionId: metadata.sessionId,
      eventType: eventType as any,
      severity: this.calculateSeverity(eventType, metadata.riskScore),
      description: this.generateDescription(eventType, metadata),
      metadata: {
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        timestamp: Date.now(),
        details: {
          riskScore: metadata.riskScore,
          threatIndicators: metadata.threatIndicators,
          dataAccessed: metadata.dataAccessed,
          actionTaken: metadata.actionTaken,
          geolocation: await this.getGeolocation(metadata.ipAddress)
        }
      },
      resolved: false
    }

    // Store in multiple locations for redundancy
    await Promise.all([
      redisCache.set(`security_event:${securityEvent.id}`, securityEvent, 86400 * 30), // 30 days
      this.storeInAuditDatabase(securityEvent),
      this.alertSecurityTeam(securityEvent)
    ])
  }

  private static calculateSeverity(eventType: string, riskScore?: number): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore && riskScore >= 80) return 'critical'
    if (riskScore && riskScore >= 60) return 'high'
    if (riskScore && riskScore >= 40) return 'medium'
    return 'low'
  }

  private static generateDescription(eventType: string, metadata: any): string {
    const descriptions: Record<string, string> = {
      'suspicious_login': `Suspicious login attempt detected with risk score ${metadata.riskScore}`,
      'brute_force_attempt': 'Multiple failed login attempts indicating brute force attack',
      'account_takeover_attempt': 'Potential account takeover attempt detected',
      'data_exfiltration_attempt': 'Unusual data access pattern suggesting exfiltration attempt'
    }
    return descriptions[eventType] || `Security event: ${eventType}`
  }

  private static async getGeolocation(ipAddress: string): Promise<any> {
    // In production, use a geolocation service
    return {
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      latitude: null,
      longitude: null
    }
  }

  private static async storeInAuditDatabase(event: SecurityEvent): Promise<void> {
    // In production, store in secure audit database
    console.log('📊 Security event stored in audit database:', event.id)
  }

  private static async alertSecurityTeam(event: SecurityEvent): Promise<void> {
    if (event.severity === 'critical' || event.severity === 'high') {
      // In production, send alerts via email, Slack, PagerDuty, etc.
      console.log(`🚨 Security alert: ${event.eventType} - ${event.description}`)
    }
  }
}

/**
 * Session security enhancements
 */
export class SessionSecurity {
  /**
   * Implement concurrent session limits
   */
  static async enforceSessionLimits(userId: string, maxSessions: number = 3): Promise<boolean> {
    const sessionKey = `user_sessions:${userId}`
    const activeSessions = await redisCache.get(sessionKey) || []

    if (activeSessions.length >= maxSessions) {
      // Terminate oldest session
      const oldestSession = activeSessions[0]
      await this.terminateSession(oldestSession.sessionId)
      activeSessions.shift()
    }

    return activeSessions.length < maxSessions
  }

  /**
   * Detect session hijacking attempts
   */
  static async validateSessionConsistency(
    sessionId: string,
    currentInfo: {
      ipAddress: string
      userAgent: string
      deviceFingerprint?: string
    }
  ): Promise<{ valid: boolean; reasons?: string[] }> {
    const storedSession = await redisCache.get(`session:${sessionId}`)
    if (!storedSession) {
      return { valid: false, reasons: ['Session not found'] }
    }

    const inconsistencies: string[] = []

    // Check for significant IP changes (allowing for mobile network changes)
    if (!this.isIPRangeValid(storedSession.ipAddress, currentInfo.ipAddress)) {
      inconsistencies.push('IP address changed significantly')
    }

    // Check for user agent changes
    if (storedSession.userAgent !== currentInfo.userAgent) {
      inconsistencies.push('User agent changed')
    }

    // Check for device fingerprint changes
    if (storedSession.deviceFingerprint &&
        currentInfo.deviceFingerprint &&
        storedSession.deviceFingerprint !== currentInfo.deviceFingerprint) {
      inconsistencies.push('Device fingerprint changed')
    }

    return {
      valid: inconsistencies.length === 0,
      reasons: inconsistencies.length > 0 ? inconsistencies : undefined
    }
  }

  private static isIPRangeValid(originalIP: string, currentIP: string): boolean {
    // Allow for reasonable IP changes (same subnet for mobile users)
    const originalParts = originalIP.split('.')
    const currentParts = currentIP.split('.')

    // Same first two octets is usually acceptable
    return originalParts[0] === currentParts[0] && originalParts[1] === currentParts[1]
  }

  private static async terminateSession(sessionId: string): Promise<void> {
    await redisCache.del(`session:${sessionId}`)
    console.log(`🔒 Session ${sessionId} terminated due to limit enforcement`)
  }
}

/**
 * Data encryption for sensitive information
 */
export class DataEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32)

  /**
   * Encrypt sensitive data before storage
   */
  static encrypt(data: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipher(this.ALGORITHM, this.KEY)
    cipher.setAAD(Buffer.from('financial-data'))

    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const tag = cipher.getAuthTag()

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    }
  }

  /**
   * Decrypt sensitive data after retrieval
   */
  static decrypt(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    const decipher = crypto.createDecipher(this.ALGORITHM, this.KEY)
    decipher.setAAD(Buffer.from('financial-data'))
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'))

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }
}

/**
 * API key security enhancements
 */
export class APIKeySecurity {
  /**
   * Generate secure API keys with metadata
   */
  static generateAPIKey(userId: string, permissions: string[]): {
    keyId: string
    secret: string
    hash: string
  } {
    const keyId = `vkt_${crypto.randomBytes(8).toString('hex')}`
    const secret = crypto.randomBytes(32).toString('hex')
    const hash = crypto.pbkdf2Sync(secret, keyId, 100000, 64, 'sha512').toString('hex')

    return { keyId, secret, hash }
  }

  /**
   * Implement API key rotation
   */
  static async rotateAPIKey(oldKeyId: string): Promise<{
    newKeyId: string
    newSecret: string
    gracePeriod: number
  }> {
    // Mark old key as deprecated
    await redisCache.set(`deprecated_key:${oldKeyId}`, true, 86400 * 7) // 7 days grace period

    // Generate new key
    const newKey = this.generateAPIKey('user_id', [])

    return {
      newKeyId: newKey.keyId,
      newSecret: newKey.secret,
      gracePeriod: 86400 * 7 // 7 days
    }
  }
}