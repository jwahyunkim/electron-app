import { useState, useEffect } from 'react'

function useScrollbarWidth(): number {
  const [scrollbarWidth, setScrollbarWidth] = useState(0)

  useEffect(() => {
    // 1. 임시 div 생성
    const scrollDiv = document.createElement('div')
    scrollDiv.style.width = '100px'
    scrollDiv.style.height = '100px'
    scrollDiv.style.overflow = 'scroll'
    scrollDiv.style.position = 'absolute'
    scrollDiv.style.top = '-9999px'
    document.body.appendChild(scrollDiv)

    // 2. 너비 계산
    const width = scrollDiv.offsetWidth - scrollDiv.clientWidth
    document.body.removeChild(scrollDiv)

    // 3. 상태 업데이트
    setScrollbarWidth(width)
  }, [])

  return scrollbarWidth
}

export default useScrollbarWidth
