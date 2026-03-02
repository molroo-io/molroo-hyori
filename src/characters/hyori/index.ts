import type { CharacterPackage } from '../types'
import { HYORI_EXPRESSIONS } from './expressions'
import { HYORI_MOTIONS } from './motions'

export const hyoriCharacter: CharacterPackage = {
  name: 'Hyori',
  modelUrl: import.meta.env.VITE_MODEL_URL || `${import.meta.env.BASE_URL}models/hiyori_pro_zh/hiyori_pro_t11.model3.json`,
  expressions: HYORI_EXPRESSIONS,
  motions: HYORI_MOTIONS,
}
