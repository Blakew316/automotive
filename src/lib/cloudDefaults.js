// The shop's own Supabase project ("AutoShop Pro"). Every device starts connected to it; staff sign
// in once per device. The anon key is public by design — database policies (a staff flag in each
// account's app_metadata) are what protect uploads and the customer inbox.
import { SMALL_ENGINE } from './edition';

export const SHOP_CLOUD = {
  url: 'https://huwcrbkplpudpsfczbyg.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1d2NyYmtwbHB1ZHBzZmN6YnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzMwMjgsImV4cCI6MjEwNjQwOTAyOH0.qnQb14ObGJTyDirYM3fDk2eX-sjTZIaec74aeJAnJ-I',
  bucket: 'autoshop-media',
};

/**
 * Whether new devices start connected to that project. The Small Engine Edition is offered to other
 * shops, so it starts on the device only until the shop connects its own Shop Cloud in Settings.
 */
export const BUILT_IN_CLOUD = !SMALL_ENGINE;
