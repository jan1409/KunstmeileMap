import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Category, Tent } from '../lib/supabase';

const TentSchema = z.object({
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
  display_number: z
    .union([
      z.literal('').transform(() => undefined),
      z.coerce.number().int().positive(),
    ])
    .optional(),
  category_ids: z.array(z.string().uuid()).default([]),
  website_url: z.url().optional().or(z.literal('')),
  instagram_url: z.url().optional().or(z.literal('')),
  facebook_url: z.url().optional().or(z.literal('')),
  email_public: z.email().optional().or(z.literal('')),
});

export type TentFormValues = z.infer<typeof TentSchema>;

interface Props {
  initial?: Partial<Tent> & { display_number?: number | null; category_ids?: string[] };
  categories: Category[];
  position: { x: number; y: number; z: number } | null;
  onRequestPlace: () => void;
  onSubmit: (values: TentFormValues) => Promise<void>;
}

export function TentEditForm({
  initial,
  categories,
  position,
  onRequestPlace,
  onSubmit,
}: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.output<typeof TentSchema>>({
    resolver: zodResolver(TentSchema) as never,
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
    },
  });

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
      <Field label="#">
        <input
          type="number"
          inputMode="numeric"
          placeholder="auto"
          {...register('display_number')}
          className="input"
        />
      </Field>
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

      <div className="rounded border border-white/10 p-3">
        <div className="text-xs text-white/60">Position</div>
        <div className="font-mono text-sm">
          {position
            ? `(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`
            : '— not placed —'}
        </div>
        <button
          type="button"
          onClick={onRequestPlace}
          className="mt-2 rounded bg-white/10 px-3 py-1 text-sm"
        >
          {position ? 'Reposition' : 'Place on scene'}
        </button>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !position}
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
