import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Category, Tent } from '../lib/supabase';
import { TentMapEditor } from './TentMapEditor';

const TentSchema = z
  .object({
    slug: z
      .string()
      .min(1, 'Slug is required')
      .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, digits, and dashes'),
    name: z.string().min(1, 'Name is required'),
    description_de: z.string().optional(),
    description_en: z.string().optional(),
    address: z.string().optional(),
    // Accept empty string (map to undefined) or a positive integer.
    // The blank case lets the DB trigger auto-assign the number.
    display_number: z.preprocess(
      (v) => (v === '' || v == null ? undefined : Number(v)),
      z.number().int().positive().optional(),
    ),
    category_ids: z.array(z.string().uuid()).default([]),
    website_url: z.url().optional().or(z.literal('')),
    instagram_url: z.url().optional().or(z.literal('')),
    facebook_url: z.url().optional().or(z.literal('')),
    email_public: z.email().optional().or(z.literal('')),
    lat: z.number().gte(-90).lte(90).nullable().optional(),
    lng: z.number().gte(-180).lte(180).nullable().optional(),
  })
  .refine(
    (v) => {
      const hasLat = v.lat != null;
      const hasLng = v.lng != null;
      return hasLat === hasLng;
    },
    { message: 'Lat and Lng must both be set or both be empty', path: ['lat'] },
  );

export type TentFormValues = z.infer<typeof TentSchema>;

interface Props {
  initial?: Partial<Tent> & {
    display_number?: number | null;
    category_ids?: string[];
    lat?: number | null;
    lng?: number | null;
  };
  categories: Category[];
  defaultCenter: [number, number];
  defaultZoom: number;
  onSubmit: (values: TentFormValues) => Promise<void>;
}

export function TentEditForm({
  initial,
  categories,
  defaultCenter,
  defaultZoom,
  onSubmit,
}: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof TentSchema>, unknown, z.output<typeof TentSchema>>({
    resolver: zodResolver(TentSchema),
    defaultValues: {
      slug: initial?.slug ?? '',
      name: initial?.name ?? '',
      description_de: initial?.description_de ?? '',
      description_en: initial?.description_en ?? '',
      address: initial?.address ?? '',
      display_number: initial?.display_number ?? undefined,
      category_ids: initial?.category_ids ?? [],
      website_url: initial?.website_url ?? '',
      instagram_url: initial?.instagram_url ?? '',
      facebook_url: initial?.facebook_url ?? '',
      email_public: initial?.email_public ?? '',
      lat: initial?.lat ?? null,
      lng: initial?.lng ?? null,
    },
  });

  // Watch lat/lng so TentMapEditor reflects the latest form state. We use
  // setValue (not Controller-per-field) so the map editor stays a controlled,
  // stateless view of two RHF fields. The 3-type-param useForm signature means
  // the watched values inherit the *input* shape (number | null | undefined).
  const [watchedLat, watchedLng] = useWatch({ control, name: ['lat', 'lng'] }) as [
    number | null | undefined,
    number | null | undefined,
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-3">
      <Field label="Slug" error={errors.slug?.message}>
        <input {...register('slug')} className="input" />
      </Field>
      <Field label="Name" error={errors.name?.message}>
        <input {...register('name')} className="input" />
      </Field>
      <Field label="Beschreibung (DE)">
        <textarea {...register('description_de')} rows={4} className="input" />
      </Field>
      <Field label="Description (EN)">
        <textarea {...register('description_en')} rows={4} className="input" />
      </Field>
      <Field label="Adresse">
        <input {...register('address')} className="input" />
      </Field>
      <Field label="#" error={errors.display_number?.message}>
        <input
          type="number"
          inputMode="numeric"
          placeholder="auto"
          {...register('display_number')}
          className="input"
        />
      </Field>
      {/* Checkbox group can't live inside <Field> because Field wraps children
          in a <label>; nested <label> elements are invalid HTML. We replicate
          Field's label-span styling on a <div> wrapper instead. */}
      <div>
        <span className="block text-xs text-white/60">Kategorien</span>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <label key={c.id} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                value={c.id}
                {...register('category_ids')}
                className="h-4 w-4"
              />
              <span>
                {c.icon} {c.name_de}
              </span>
            </label>
          ))}
        </div>
      </div>
      <Field label="Website" error={errors.website_url?.message}>
        <input {...register('website_url')} className="input" />
      </Field>
      <Field label="Instagram" error={errors.instagram_url?.message}>
        <input {...register('instagram_url')} className="input" />
      </Field>
      <Field label="Facebook" error={errors.facebook_url?.message}>
        <input {...register('facebook_url')} className="input" />
      </Field>
      <Field label="Public email" error={errors.email_public?.message}>
        <input {...register('email_public')} className="input" />
      </Field>

      <div>
        <span className="mb-2 block text-xs text-white/60">Position</span>
        <TentMapEditor
          lat={watchedLat ?? null}
          lng={watchedLng ?? null}
          defaultCenter={defaultCenter}
          defaultZoom={defaultZoom}
          onChange={({ lat, lng }) => {
            setValue('lat', lat ?? null, { shouldDirty: true, shouldValidate: true });
            setValue('lng', lng ?? null, { shouldDirty: true, shouldValidate: true });
          }}
        />
        {errors.lat && (
          <span role="alert" className="mt-1 block text-xs text-red-400">
            {errors.lat.message}
          </span>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-white/20 px-4 py-2 disabled:opacity-50"
      >
        {isSubmitting ? '…' : 'Save'}
      </button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block">
        <span className="block text-xs text-white/60">{label}</span>
        {children}
      </label>
      {error && (
        <span role="alert" className="mt-1 block text-xs text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}
