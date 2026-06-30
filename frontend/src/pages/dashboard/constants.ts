// Theme-aware color palette — used across all dashboard components
export function getThemeColors(theme: 'dark' | 'light') {
  const isDark = theme === 'dark';
  return {
    GREEN: isDark ? '#34D399' : '#059669',
    AMBER: isDark ? '#FBBF24' : '#D97706',
    RED: isDark ? '#F43F5E' : '#DC2626',
    BLUE: isDark ? '#00D4FF' : '#0284C7',
    PURPLE: isDark ? '#A78BFA' : '#7C3AED',
  } as const;
}

export type ThemeColors = ReturnType<typeof getThemeColors>;

// Status-to-color mapping helpers
export function getStatusColor(status: string, colors: ThemeColors): string {
  switch (status) {
    case 'Normal': return colors.GREEN;
    case 'Buildup': return colors.AMBER;
    case 'Blasting': return colors.BLUE;
    default: return colors.RED;
  }
}

export function getStatusBg(status: string): string {
  switch (status) {
    case 'Normal': return 'rgba(52,211,153,0.1)';
    case 'Buildup': return 'rgba(251,191,36,0.1)';
    case 'Blasting': return 'rgba(0,212,255,0.1)';
    default: return 'rgba(244,63,94,0.1)';
  }
}

export function getAlertColorMap(colors: ThemeColors): Record<string, string> {
  return {
    Low: colors.GREEN,
    Medium: colors.AMBER,
    High: '#FBBF24',
    Critical: colors.RED,
  };
}
