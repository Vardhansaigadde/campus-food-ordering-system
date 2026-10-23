import { PageHeader } from '../../components/ui'
import { ChangePassword } from '../student/Account'

export default function Account() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Change password" />
      <ChangePassword />
    </div>
  )
}
