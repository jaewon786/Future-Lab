import { describe, expect, it } from 'vitest';
import { fuseThrust } from './thrust-fusion';

const arm = (tMs: number, swordArmDeg: number) => ({ tMs, swordArmDeg });

describe('fuseThrust (폰 찌르기 + 웹캠 칼 팔)', () => {
  it('±150ms 안에 칼 팔이 160° 이상이면 인정', () => {
    expect(fuseThrust(1000, [arm(900, 150), arm(1100, 172)])).toEqual({ accepted: true, reason: 'arm-extended' });
  });

  it('팔이 보이는데 덜 폈으면 거부', () => {
    expect(fuseThrust(1000, [arm(950, 130), arm(1050, 150)])).toEqual({ accepted: false, reason: 'arm-bent' });
  });

  it('구간 밖의 팔 각도는 보지 않는다', () => {
    expect(fuseThrust(1000, [arm(700, 175), arm(1000, 140)])).toEqual({ accepted: false, reason: 'arm-bent' });
  });

  it('구간 안에서 팔이 안 보이면(NaN) 폰 감지만으로 인정', () => {
    expect(fuseThrust(1000, [arm(1000, Number.NaN), arm(500, 175)])).toEqual({
      accepted: true,
      reason: 'arm-not-visible',
    });
  });

  it('창 크기와 기준 각도를 바꿀 수 있다', () => {
    expect(fuseThrust(1000, [arm(1200, 165)], { windowMs: 250, minArmDeg: 170 }).reason).toBe('arm-bent');
  });
});
