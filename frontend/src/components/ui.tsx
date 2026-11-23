'use client';

// Aquí se reúnen botones, avisos y campos que se comparten entre pantallas.
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useState, type ButtonHTMLAttributes, type ComponentProps, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'light';

// Botón para acciones y enlace con la misma apariencia para cambiar de pantalla.
export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={`button button--${variant} ${className}`.trim()} {...props} />;
}

export function ButtonLink({ variant = 'primary', className = '', ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant; className?: string }) {
  return <Link className={`button button--${variant} ${className}`.trim()} {...props} />;
}

// Contenedor blanco que agrupa información relacionada.
export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`surface-card ${className}`.trim()} {...props} />;
}

// Etiqueta pequeña para categorías, roles o estados.
export function Badge({ className = '', ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={`badge ${className}`.trim()} {...props} />;
}

// Este mensaje aparece cuando una lista todavía no tiene resultados.
export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state__icon"><Icon aria-hidden="true" /></span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

// Los avisos usan colores distintos para errores, confirmaciones e información.
export function Alert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'success' | 'info' }) {
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle;
  return <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}><Icon aria-hidden="true" /><div>{children}</div></div>;
}

type FormFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> & {
  id: string;
  label: string;
  icon: LucideIcon;
  type?: 'text' | 'email' | 'password';
  strength?: { level: number; label: string };
};

// Campo reutilizable con etiqueta, icono y opciones para contraseñas.
export function FormField({ id, label, icon: Icon, type = 'text', strength, ...inputProps }: FormFieldProps) {
  const [mostrar, setMostrar] = useState(false);
  const inputType = type === 'password' && mostrar ? 'text' : type;

  // Al escribir una contraseña se puede alternar entre verla y ocultarla.
  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={id}>{label}</label>
      <span className="form-field__control">
        <Icon className="form-field__icon" aria-hidden="true" />
        <input id={id} type={inputType} {...inputProps} />
        {type === 'password' && (
          <button
            className="password-toggle"
            type="button"
            aria-label={mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onClick={() => setMostrar((actual) => !actual)}
          >
            {mostrar ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        )}
      </span>
      {strength && (
        <span className="password-strength" aria-live="polite">
          <span className="password-strength__bars" aria-hidden="true">
            {[1, 2, 3, 4].map((step) => <i className={step <= strength.level ? 'is-active' : ''} key={step} />)}
          </span>
          <span>{strength.label}</span>
        </span>
      )}
    </div>
  );
}
