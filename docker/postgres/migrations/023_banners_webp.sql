-- Point seeded / uploaded banners at WebP assets after conversion.

update banners set
  image_ru = regexp_replace(image_ru, '\.(png|jpe?g|gif)$', '.webp', 'i'),
  image_en = regexp_replace(image_en, '\.(png|jpe?g|gif)$', '.webp', 'i'),
  updated_at = now()
where image_ru ~* '\.(png|jpe?g|gif)$'
   or image_en ~* '\.(png|jpe?g|gif)$';
