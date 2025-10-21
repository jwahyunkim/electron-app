import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'

interface TimeNowProps {
  formatStr?: string // 날짜 형식, 기본값 있음
}

const TimeNow: React.FC<TimeNowProps> = ({ formatStr = 'yyyy-MM-dd HH:mm:ss' }) => {
  const [now, setNow] = useState(format(new Date(), formatStr))

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(format(new Date(), formatStr))
    }, 1000)
    return () => clearInterval(timer)
  }, [formatStr])

  return <>{now}</>
}

export default TimeNow
